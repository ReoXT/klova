import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('../services/walletGuardService', () => ({
  flagIfWalletNegative: vi.fn().mockResolvedValue(undefined),
}));

import { supabase } from '../lib/supabase';
import { flagIfWalletNegative } from '../services/walletGuardService';
import { adjustEarningForRefund } from '../services/earningsService';

function chain(result: { data: unknown; error: unknown }) {
  const b: any = {};
  b.then = (resolve: (v: any) => any, reject?: (v: any) => any) =>
    Promise.resolve(result).then(resolve, reject);
  b.catch = (fn: (v: any) => any) => Promise.resolve(result).catch(fn);
  for (const m of ['select', 'eq', 'in', 'update']) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  return b;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('adjustEarningForRefund — refund-after-withdrawal flagging', () => {
  it('full refund: flags the wallet-negative check for the affected keeper after zeroing their earning', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        chain({
          data: [{ id: 'e-1', cleaner_id: 'keeper-1', earning_kobo: 741000, status: 'unpaid' }],
          error: null,
        }) as any,
      ) // SELECT earnings
      .mockReturnValueOnce(chain({ data: null, error: null }) as any); // UPDATE -> refunded

    await adjustEarningForRefund('booking-1', 950000, 950000);

    expect(vi.mocked(flagIfWalletNegative)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(flagIfWalletNegative)).toHaveBeenCalledWith(
      'keeper-1',
      expect.stringContaining('booking-1'),
    );
  });

  it('two-keeper booking: flags each distinct keeper exactly once', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        chain({
          data: [
            { id: 'e-1', cleaner_id: 'keeper-1', earning_kobo: 370500, status: 'unpaid' },
            { id: 'e-2', cleaner_id: 'keeper-2', earning_kobo: 370500, status: 'unpaid' },
          ],
          error: null,
        }) as any,
      )
      .mockReturnValueOnce(chain({ data: null, error: null }) as any);

    await adjustEarningForRefund('booking-2', 950000, 950000);

    expect(vi.mocked(flagIfWalletNegative)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(flagIfWalletNegative)).toHaveBeenCalledWith('keeper-1', expect.any(String));
    expect(vi.mocked(flagIfWalletNegative)).toHaveBeenCalledWith('keeper-2', expect.any(String));
  });

  it('partial refund: still flags the scaled-down keeper (their withdrawal may now exceed the reduced earning)', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        chain({
          data: [{ id: 'e-1', cleaner_id: 'keeper-1', earning_kobo: 741000, status: 'unpaid' }],
          error: null,
        }) as any,
      )
      .mockReturnValueOnce(chain({ data: null, error: null }) as any); // per-row UPDATE (partial)

    await adjustEarningForRefund('booking-3', 475000, 950000); // 50% refund

    expect(vi.mocked(flagIfWalletNegative)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(flagIfWalletNegative)).toHaveBeenCalledWith('keeper-1', expect.stringContaining('booking-3'));
  });

  it('already-paid earnings: bails out before touching the ledger or the wallet check (manual review case)', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({
        data: [{ id: 'e-1', cleaner_id: 'keeper-1', earning_kobo: 741000, status: 'paid' }],
        error: null,
      }) as any,
    );

    await adjustEarningForRefund('booking-4', 950000, 950000);

    expect(vi.mocked(flagIfWalletNegative)).not.toHaveBeenCalled();
    // Only the SELECT ran — no UPDATE was ever attempted.
    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(1);
  });

  it('no earnings recorded yet: no-op, no wallet check', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(chain({ data: [], error: null }) as any);

    await adjustEarningForRefund('booking-5', 950000, 950000);

    expect(vi.mocked(flagIfWalletNegative)).not.toHaveBeenCalled();
  });

  it('all rows already refunded: no-op, no wallet check (idempotent re-delivery)', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({
        data: [{ id: 'e-1', cleaner_id: 'keeper-1', earning_kobo: 0, status: 'refunded' }],
        error: null,
      }) as any,
    );

    await adjustEarningForRefund('booking-6', 950000, 950000);

    expect(vi.mocked(flagIfWalletNegative)).not.toHaveBeenCalled();
  });
});
