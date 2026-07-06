import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from '../lib/supabase';
import { flagIfWalletNegative } from '../services/walletGuardService';

// Thenable-only chain (every call in walletGuardService is a plain SELECT
// awaited directly, no .single()/.maybeSingle() needed).
function chain(result: { data: unknown; error: unknown }) {
  const b: any = {};
  b.then = (resolve: (v: any) => any, reject?: (v: any) => any) =>
    Promise.resolve(result).then(resolve, reject);
  b.catch = (fn: (v: any) => any) => Promise.resolve(result).catch(fn);
  for (const m of ['select', 'eq', 'is', 'gt', 'in']) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  return b;
}

// Mocks the four parallel queries flagIfWalletNegative issues, in the fixed
// order the implementation calls them: earnings, transport, payouts, adjustments.
function mockWallet(opts: {
  owedEarnings?: { earning_kobo: number; status: string }[];
  transport?: { transport_fare_kobo: number }[];
  payouts?: { amount_kobo: number | null; total_kobo: number; status: string }[];
  adjustments?: { amount_kobo: number }[];
}) {
  vi.mocked(supabase.from)
    .mockReturnValueOnce(chain({ data: opts.owedEarnings ?? [], error: null }) as any)
    .mockReturnValueOnce(chain({ data: opts.transport ?? [], error: null }) as any)
    .mockReturnValueOnce(chain({ data: opts.payouts ?? [], error: null }) as any)
    .mockReturnValueOnce(chain({ data: opts.adjustments ?? [], error: null }) as any);
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('flagIfWalletNegative — reconciliation hold (keeper_paid_out settled bookings)', () => {
  it('an earning already settled to status=paid (via the historical keeper_paid_out reconciliation) never counts as owed', async () => {
    // Mirrors a booking that was paid out under the old bookings.keeper_paid_out
    // flow and reconciled by 20260701000001_reconcile_keeper_paid_out.sql —
    // its cleaner_earnings row is 'paid', not 'unpaid'. If this ever counted
    // as owed again, a keeper could be shown (and could withdraw) money
    // twice for the same booking. With no withdrawal on file, available must
    // come out to exactly 0 (the paid row contributes nothing), not 741000.
    mockWallet({
      owedEarnings: [{ earning_kobo: 741000, status: 'paid' }],
      payouts: [],
    });

    await flagIfWalletNegative('keeper-1', 'test');

    // available is 0, not negative and not 741000 — the 'paid' row is
    // correctly excluded from owed. Nothing to flag.
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('flagIfWalletNegative — positive/zero balance', () => {
  it('logs nothing when available is exactly zero', async () => {
    mockWallet({
      owedEarnings: [{ earning_kobo: 0, status: 'unpaid' }],
      payouts: [{ amount_kobo: 0, total_kobo: 0, status: 'success' }],
    });

    await flagIfWalletNegative('keeper-1', 'test');

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs nothing when owed still covers what was withdrawn', async () => {
    mockWallet({
      owedEarnings: [{ earning_kobo: 500000, status: 'unpaid' }],
      payouts: [{ amount_kobo: 200000, total_kobo: 200000, status: 'success' }],
    });

    await flagIfWalletNegative('keeper-1', 'test');

    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('flagIfWalletNegative — the refund-after-withdrawal scenario', () => {
  it('flags a clear [wallet-negative] error when a refund zeroed an earning the keeper already withdrew against', async () => {
    // Keeper withdrew ₦2,000 (200000 kobo) against a ₦2,000 earning that a
    // refund has since zeroed out. Nothing else owed.
    mockWallet({
      owedEarnings: [{ earning_kobo: 0, status: 'refunded' }],
      payouts: [{ amount_kobo: 200000, total_kobo: 200000, status: 'success' }],
    });

    await flagIfWalletNegative('keeper-1', 'a refund on booking b-1');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [message] = errorSpy.mock.calls[0] as [string];
    expect(message).toContain('[wallet-negative]');
    expect(message).toContain('keeper-1');
    expect(message).toContain('a refund on booking b-1');
  });

  it('accounts for owed transport and manual adjustments in the same balance', async () => {
    mockWallet({
      owedEarnings: [],
      transport: [{ transport_fare_kobo: 50000 }],
      payouts: [{ amount_kobo: 200000, total_kobo: 200000, status: 'success' }],
      adjustments: [{ amount_kobo: -10000 }],
    });
    // available = 0 + 50000 - 200000 + (-10000) = -160000 → still negative

    await flagIfWalletNegative('keeper-2', 'test');

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('excludes failed/reversed withdrawals from the withdrawn total (they never left the account)', async () => {
    mockWallet({
      owedEarnings: [{ earning_kobo: 0, status: 'refunded' }],
      payouts: [
        { amount_kobo: 200000, total_kobo: 200000, status: 'failed' },
        { amount_kobo: 200000, total_kobo: 200000, status: 'reversed' },
      ],
    });
    // Both withdrawals never actually completed, so available = 0, not negative.

    await flagIfWalletNegative('keeper-3', 'test');

    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('flagIfWalletNegative — never throws', () => {
  it('swallows a query error and logs instead of propagating it to the caller', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({ data: null, error: { message: 'connection refused' } }) as any,
    );

    await expect(flagIfWalletNegative('keeper-4', 'test')).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect((errorSpy.mock.calls[0] as unknown[])[0]).toContain('balance check itself failed');
  });
});
