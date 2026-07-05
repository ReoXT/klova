import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('../config', () => ({
  config: { paystackSecretKey: 'sk_test_dummy' },
}));

import { supabase } from '../lib/supabase';
import { handleTransferWebhook } from '../services/payoutService';

// Thenable Supabase chain — supports direct-await (UPDATE queries) and
// explicit terminal calls (.single/.maybeSingle for SELECT queries),
// matching the convention in webhookController.test.ts.
function chain(result: { data: unknown; error: unknown }) {
  const b: any = {};
  b.then = (resolve: (v: any) => any, reject?: (v: any) => any) =>
    Promise.resolve(result).then(resolve, reject);
  b.catch = (fn: (v: any) => any) => Promise.resolve(result).catch(fn);
  b.single = vi.fn().mockResolvedValue(result);
  b.maybeSingle = vi.fn().mockResolvedValue(result);
  for (const m of ['select', 'eq', 'update', 'not', 'in', 'gte', 'order']) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  return b;
}

function payoutRow(overrides: Partial<{ id: string; status: string; requested_by: string }> = {}) {
  return { id: 'payout-1', status: 'processing', requested_by: 'keeper', ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Keeper withdrawal: transfer.success ──────────────────────────────────────

describe('handleTransferWebhook — keeper withdrawal, transfer.success', () => {
  it('flips the payout to success and touches no earnings/booking_cleaners rows', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(chain({ data: payoutRow(), error: null }) as any) // SELECT payout
      .mockReturnValueOnce(chain({ data: null, error: null }) as any);       // UPDATE payout -> success

    await handleTransferWebhook('transfer.success', { reference: 'klova-kwd-ref-1' });

    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(supabase.from)).toHaveBeenNthCalledWith(1, 'cleaner_payouts');
    expect(vi.mocked(supabase.from)).toHaveBeenNthCalledWith(2, 'cleaner_payouts');
    // No cleaner_earnings / booking_cleaners calls for a keeper withdrawal —
    // keeper_request_withdrawal never links any such rows to the payout.
    expect(vi.mocked(supabase.from)).not.toHaveBeenCalledWith('cleaner_earnings');
    expect(vi.mocked(supabase.from)).not.toHaveBeenCalledWith('booking_cleaners');
  });
});

// ─── Keeper withdrawal: transfer.failed returns the amount to available ──────
//
// available_kobo (both keeper_request_withdrawal's v_withdrawn and
// getWalletSummary's withdrawn_or_pending_kobo) sums cleaner_payouts rows
// NOT IN ('failed','reversed') for this cleaner. Flipping status to 'failed'
// IS the entire "credit back to available" effect — verified here by
// asserting the update call, and that it happens exactly once even under a
// duplicate delivery.

describe('handleTransferWebhook — keeper withdrawal, transfer.failed', () => {
  it('flips the payout to failed exactly once — a failed transfer returns the amount to available exactly once', async () => {
    // First delivery: payout is still 'processing'.
    vi.mocked(supabase.from)
      .mockReturnValueOnce(chain({ data: payoutRow({ status: 'processing' }), error: null }) as any)
      .mockReturnValueOnce(chain({ data: null, error: null }) as any); // UPDATE -> failed

    await handleTransferWebhook('transfer.failed', {
      reference: 'klova-kwd-ref-2',
      reason: 'Insufficient balance',
    });

    const updateCall = vi.mocked(supabase.from).mock.results[1].value;
    expect(updateCall.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', failure_reason: 'Insufficient balance' }),
    );
    expect(updateCall.eq).toHaveBeenCalledWith('id', 'payout-1');

    // No earnings/booking_cleaners revert calls for a keeper withdrawal.
    expect(vi.mocked(supabase.from)).not.toHaveBeenCalledWith('cleaner_earnings');
    expect(vi.mocked(supabase.from)).not.toHaveBeenCalledWith('booking_cleaners');
    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(2);
  });

  it('is idempotent — a duplicate transfer.failed delivery does not re-apply', async () => {
    // Second delivery: payout is ALREADY 'failed' from the first delivery.
    vi.mocked(supabase.from)
      .mockReturnValueOnce(chain({ data: payoutRow({ status: 'failed' }), error: null }) as any);

    await handleTransferWebhook('transfer.failed', {
      reference: 'klova-kwd-ref-2',
      reason: 'Insufficient balance',
    });

    // Only the SELECT ran — the terminal-state guard stopped before any UPDATE.
    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(1);
  });
});

// ─── Admin batch payout: settlement side effects still apply ─────────────────

describe('handleTransferWebhook — admin batch payout (requested_by=admin)', () => {
  it('on success, flips linked cleaner_earnings and booking_cleaners rows', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(chain({ data: payoutRow({ requested_by: 'admin' }), error: null }) as any)
      .mockReturnValueOnce(chain({ data: null, error: null }) as any) // UPDATE payout -> success
      .mockReturnValueOnce(chain({ data: null, error: null }) as any) // UPDATE cleaner_earnings -> paid
      .mockReturnValueOnce(chain({ data: null, error: null }) as any); // UPDATE booking_cleaners -> paid_out

    await handleTransferWebhook('transfer.success', { reference: 'klova-payout-ref-1' });

    expect(vi.mocked(supabase.from)).toHaveBeenNthCalledWith(3, 'cleaner_earnings');
    expect(vi.mocked(supabase.from)).toHaveBeenNthCalledWith(4, 'booking_cleaners');
    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(4);
  });

  it('on failure, reverts linked cleaner_earnings and booking_cleaners rows', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(chain({ data: payoutRow({ requested_by: 'admin', status: 'processing' }), error: null }) as any)
      .mockReturnValueOnce(chain({ data: null, error: null }) as any) // UPDATE payout -> failed
      .mockReturnValueOnce(chain({ data: null, error: null }) as any) // UPDATE cleaner_earnings -> failed
      .mockReturnValueOnce(chain({ data: null, error: null }) as any); // UPDATE booking_cleaners -> unlink

    await handleTransferWebhook('transfer.failed', { reference: 'klova-payout-ref-2' });

    expect(vi.mocked(supabase.from)).toHaveBeenNthCalledWith(3, 'cleaner_earnings');
    expect(vi.mocked(supabase.from)).toHaveBeenNthCalledWith(4, 'booking_cleaners');
    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(4);
  });
});

// ─── Delivery-order guard ──────────────────────────────────────────────────────

describe('handleTransferWebhook — out-of-order / duplicate delivery', () => {
  it('ignores a duplicate transfer.success once already success', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(chain({ data: payoutRow({ status: 'success' }), error: null }) as any);

    await handleTransferWebhook('transfer.success', { reference: 'r' });

    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(1); // only the SELECT
  });

  it('ignores a late transfer.failed arriving after the payout already succeeded — never downgrades a completed transfer', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(chain({ data: payoutRow({ status: 'success' }), error: null }) as any);

    await handleTransferWebhook('transfer.failed', { reference: 'r' });

    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(1); // only the SELECT — no downgrade applied
  });

  it('applies a genuine transfer.reversed arriving after a prior success (bank-side reversal)', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(chain({ data: payoutRow({ status: 'success' }), error: null }) as any)
      .mockReturnValueOnce(chain({ data: null, error: null }) as any); // UPDATE -> reversed

    await handleTransferWebhook('transfer.reversed', { reference: 'r' });

    const updateCall = vi.mocked(supabase.from).mock.results[1].value;
    expect(updateCall.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'reversed' }),
    );
  });

  it('ignores any event once already reversed (terminal)', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(chain({ data: payoutRow({ status: 'reversed' }), error: null }) as any);

    await handleTransferWebhook('transfer.success', { reference: 'r' });

    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(1);
  });
});

// ─── Unknown reference / missing reference ────────────────────────────────────

describe('handleTransferWebhook — guards', () => {
  it('no-ops when reference is missing from the payload', async () => {
    await handleTransferWebhook('transfer.success', { reference: '' });
    expect(vi.mocked(supabase.from)).not.toHaveBeenCalled();
  });

  it('warns and no-ops when no payout matches the reference', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(chain({ data: null, error: null }) as any);

    await handleTransferWebhook('transfer.success', { reference: 'ghost-ref' });

    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(1);
  });
});
