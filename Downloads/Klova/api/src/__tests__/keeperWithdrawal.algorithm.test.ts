import { describe, it, expect, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Reference-model port of keeper_request_withdrawal (see
// supabase/migrations/20260704000003_keeper_withdrawal_fn.sql).
//
// This is NOT the code that runs in production — that's the Postgres
// function itself, serialized per-keeper by a `pg_advisory_xact_lock`.
// vitest can't execute real SQL or real Postgres locking, so this is a
// line-for-line TypeScript port of that function's math and control flow,
// used here purely to pin down the ALGORITHM's correctness (overdraw
// protection, reservation, arbitrary amounts) under `pnpm test`.
//
// The live-DB proof that the real Postgres function behaves identically —
// including genuine concurrent-connection locking, which this port cannot
// exercise — is api/scripts/keeperWithdrawal.integration.mjs. Any change to
// the SQL migration must be mirrored here, and vice versa.
//
// Why "concurrent" calls below are meaningful despite JS being
// single-threaded: this function body contains no `await`, so under
// `Promise.all([...])` each call still runs to completion before the next
// one starts — exactly the serialization the SQL advisory lock provides.
// The property under test (serialized check-then-reserve never overdraws)
// is the same property the lock exists to guarantee.
// ─────────────────────────────────────────────────────────────────────────────

interface FakeEarningRow {
  earning_kobo: number;
  status: 'unpaid' | 'scheduled' | 'paid' | 'failed' | 'refunded';
}

interface FakeTransportRow {
  transport_fare_kobo: number;
  paid_out: boolean;
  transport_payout_id: string | null;
  booking_transport_status: string;
}

interface FakePayoutRow {
  amount_kobo: number;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'reversed';
  requested_by: 'keeper' | 'admin';
}

interface FakeCleanerState {
  hasPrimaryBankAccount: boolean;
  earnings: FakeEarningRow[];
  transport: FakeTransportRow[];
  payouts: FakePayoutRow[];
}

type WithdrawResult =
  | { ok: true; payout_id: string; available_kobo: number }
  | { ok: false; reason: 'invalid_amount' | 'no_bank' | 'insufficient'; available_kobo?: number };

function freshState(overrides: Partial<FakeCleanerState> = {}): FakeCleanerState {
  return {
    hasPrimaryBankAccount: true,
    earnings: [],
    transport: [],
    payouts: [],
    ...overrides,
  };
}

let payoutCounter = 0;

// Mirrors keeper_request_withdrawal.sql line for line:
//   1. reject non-positive / non-integer amounts
//   2. require a primary bank account
//   3. available = owed_earnings (unpaid) + owed_transport (settled,
//      unpaid, unlinked, positive, booking paid) − withdrawn (this
//      keeper's non-failed/reversed 'keeper' payouts)
//   4. reject if amount > available
//   5. otherwise insert a 'pending' payout row (the reservation)
function keeperRequestWithdrawal(state: FakeCleanerState, amountKobo: number): WithdrawResult {
  if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
    return { ok: false, reason: 'invalid_amount' };
  }

  if (!state.hasPrimaryBankAccount) {
    return { ok: false, reason: 'no_bank' };
  }

  const owedEarnings = state.earnings
    .filter((e) => e.status === 'unpaid')
    .reduce((s, e) => s + e.earning_kobo, 0);

  const owedTransport = state.transport
    .filter(
      (t) =>
        !t.paid_out &&
        t.transport_payout_id === null &&
        t.transport_fare_kobo > 0 &&
        t.booking_transport_status === 'paid',
    )
    .reduce((s, t) => s + t.transport_fare_kobo, 0);

  const withdrawn = state.payouts
    .filter((p) => p.requested_by === 'keeper' && p.status !== 'failed' && p.status !== 'reversed')
    .reduce((s, p) => s + p.amount_kobo, 0);

  const availableKobo = owedEarnings + owedTransport - withdrawn;

  if (amountKobo > availableKobo) {
    return { ok: false, reason: 'insufficient', available_kobo: availableKobo };
  }

  const payoutId = `payout-${++payoutCounter}`;
  state.payouts.push({ amount_kobo: amountKobo, status: 'pending', requested_by: 'keeper' });

  return { ok: true, payout_id: payoutId, available_kobo: availableKobo };
}

beforeEach(() => {
  payoutCounter = 0;
});

// ─── Balance math ──────────────────────────────────────────────────────────
//
// available = owed earnings + owed transport − non-failed/reversed
// withdrawals. This is the same formula getWalletSummary()
// (web/app/api/keeper/_wallet.ts) computes for the keeper's own wallet
// screen and the admin oversight screen (there is no getPendingPayoutSummary()
// in the current codebase — that function, and the admin batch-payout flow
// it served, were removed when keeper self-withdrawal became the only payout
// path; see supabase/migrations/20260701000002_keeper_portal_schema.sql).

describe('keeper_request_withdrawal (ported) — balance math across a mix of rows', () => {
  it('sums multiple unpaid earnings, ignores paid/refunded/failed/scheduled rows', () => {
    const state = freshState({
      earnings: [
        { earning_kobo: 741000, status: 'unpaid' },
        { earning_kobo: 370500, status: 'unpaid' },
        { earning_kobo: 500000, status: 'paid' },     // already paid — excluded
        { earning_kobo: 200000, status: 'refunded' }, // refunded — excluded
        { earning_kobo: 100000, status: 'scheduled' }, // mid-flight admin batch — excluded
        { earning_kobo: 50000, status: 'failed' },    // failed admin batch — excluded
      ],
    });

    // Force 'insufficient' with an enormous ask so we can read available_kobo
    // back without mutating state — a clean read of the balance math alone.
    const r = keeperRequestWithdrawal(state, 999_999_999);
    expect(r.ok).toBe(false);
    expect((r as { available_kobo: number }).available_kobo).toBe(741000 + 370500);
  });

  it('adds eligible transport rows and excludes ineligible ones (already paid out, in-flight, unpaid invoice)', () => {
    const state = freshState({
      earnings: [{ earning_kobo: 100000, status: 'unpaid' }],
      transport: [
        { transport_fare_kobo: 30000, paid_out: false, transport_payout_id: null, booking_transport_status: 'paid' },
        { transport_fare_kobo: 20000, paid_out: false, transport_payout_id: null, booking_transport_status: 'paid' },
        { transport_fare_kobo: 15000, paid_out: true, transport_payout_id: null, booking_transport_status: 'paid' }, // already settled
        { transport_fare_kobo: 15000, paid_out: false, transport_payout_id: 'payout-x', booking_transport_status: 'paid' }, // in-flight
        { transport_fare_kobo: 15000, paid_out: false, transport_payout_id: null, booking_transport_status: 'awaiting_payment' }, // customer hasn't paid yet
      ],
    });

    const r = keeperRequestWithdrawal(state, 999_999_999);
    expect(r.ok).toBe(false);
    expect((r as { available_kobo: number }).available_kobo).toBe(100000 + 30000 + 20000);
  });

  it('subtracts non-failed/reversed withdrawals only — failed/reversed ones do not reduce available', () => {
    const state = freshState({
      earnings: [{ earning_kobo: 1_000_000, status: 'unpaid' }],
      payouts: [
        { amount_kobo: 200000, status: 'success', requested_by: 'keeper' },
        { amount_kobo: 100000, status: 'processing', requested_by: 'keeper' },
        { amount_kobo: 50000, status: 'pending', requested_by: 'keeper' },
        { amount_kobo: 300000, status: 'failed', requested_by: 'keeper' },   // excluded
        { amount_kobo: 150000, status: 'reversed', requested_by: 'keeper' }, // excluded
        { amount_kobo: 400000, status: 'success', requested_by: 'admin' },   // different actor, different bookkeeping — excluded
      ],
    });

    const r = keeperRequestWithdrawal(state, 999_999_999);
    expect(r.ok).toBe(false);
    // available = 1,000,000 − (200,000 + 100,000 + 50,000) = 650,000
    expect((r as { available_kobo: number }).available_kobo).toBe(650000);
  });

  it('combines earnings + transport − withdrawals in one request', () => {
    const state = freshState({
      earnings: [{ earning_kobo: 500000, status: 'unpaid' }],
      transport: [{ transport_fare_kobo: 40000, paid_out: false, transport_payout_id: null, booking_transport_status: 'paid' }],
      payouts: [{ amount_kobo: 100000, status: 'success', requested_by: 'keeper' }],
    });
    // available = 500000 + 40000 - 100000 = 440000

    const r = keeperRequestWithdrawal(state, 440000);
    expect(r).toMatchObject({ ok: true, available_kobo: 440000 });
  });
});

// ─── Overdraw protection ────────────────────────────────────────────────────

describe('keeper_request_withdrawal (ported) — overdraw protection', () => {
  it('rejects an over-balance request and reserves nothing', () => {
    const state = freshState({ earnings: [{ earning_kobo: 100000, status: 'unpaid' }] });

    const r = keeperRequestWithdrawal(state, 100001);

    expect(r).toMatchObject({ ok: false, reason: 'insufficient', available_kobo: 100000 });
    expect(state.payouts).toHaveLength(0);
  });

  it('accepts exactly the full available balance', () => {
    const state = freshState({ earnings: [{ earning_kobo: 100000, status: 'unpaid' }] });

    const r = keeperRequestWithdrawal(state, 100000);

    expect(r).toMatchObject({ ok: true, available_kobo: 100000 });
    expect(state.payouts).toHaveLength(1);
  });

  it('rejects a zero-amount request', () => {
    const state = freshState({ earnings: [{ earning_kobo: 100000, status: 'unpaid' }] });
    expect(keeperRequestWithdrawal(state, 0)).toMatchObject({ ok: false, reason: 'invalid_amount' });
  });

  it('rejects a negative-amount request', () => {
    const state = freshState({ earnings: [{ earning_kobo: 100000, status: 'unpaid' }] });
    expect(keeperRequestWithdrawal(state, -500)).toMatchObject({ ok: false, reason: 'invalid_amount' });
  });

  it('rejects a fractional-kobo amount', () => {
    const state = freshState({ earnings: [{ earning_kobo: 100000, status: 'unpaid' }] });
    expect(keeperRequestWithdrawal(state, 499.5)).toMatchObject({ ok: false, reason: 'invalid_amount' });
  });

  it('has no minimum — a 1-kobo withdrawal is accepted', () => {
    const state = freshState({ earnings: [{ earning_kobo: 100000, status: 'unpaid' }] });
    expect(keeperRequestWithdrawal(state, 1)).toMatchObject({ ok: true });
  });

  it('rejects when the keeper has no primary bank account on file, regardless of balance', () => {
    const state = freshState({
      hasPrimaryBankAccount: false,
      earnings: [{ earning_kobo: 100000, status: 'unpaid' }],
    });
    expect(keeperRequestWithdrawal(state, 10000)).toMatchObject({ ok: false, reason: 'no_bank' });
  });
});

// ─── Arbitrary amounts ───────────────────────────────────────────────────────

describe('keeper_request_withdrawal (ported) — arbitrary partial amounts', () => {
  it('a ₦500 withdrawal from a ₦3,900 balance succeeds and leaves ₦3,400 available', () => {
    const state = freshState({ earnings: [{ earning_kobo: 390000, status: 'unpaid' }] }); // ₦3,900

    const r1 = keeperRequestWithdrawal(state, 50000); // ₦500
    expect(r1).toMatchObject({ ok: true, available_kobo: 390000 });

    // Read back the reduced balance via a forced-insufficient probe.
    const r2 = keeperRequestWithdrawal(state, 999_999_999);
    expect((r2 as { available_kobo: number }).available_kobo).toBe(340000); // ₦3,400

    // And the exact remainder is still withdrawable.
    const r3 = keeperRequestWithdrawal(state, 340000);
    expect(r3).toMatchObject({ ok: true });
  });

  it('several arbitrary partial withdrawals in sequence never exceed the original balance', () => {
    const state = freshState({ earnings: [{ earning_kobo: 390000, status: 'unpaid' }] });
    const amounts = [123400, 50000, 99999, 1]; // arbitrary, non-round amounts

    let lastOk = true;
    for (const amt of amounts) {
      const r = keeperRequestWithdrawal(state, amt);
      if (r.ok) continue;
      lastOk = false;
    }

    const totalReserved = state.payouts.reduce((s, p) => s + p.amount_kobo, 0);
    expect(totalReserved).toBeLessThanOrEqual(390000);
    expect(lastOk).toBe(true); // sanity: the loop actually ran meaningful amounts
  });
});

// ─── Concurrent withdrawals ──────────────────────────────────────────────────
//
// See the file header for why Promise.all() over a synchronous function body
// is a faithful stand-in for the advisory-lock's serialization guarantee.

describe('keeper_request_withdrawal (ported) — concurrent withdrawals never overdraw', () => {
  it('two concurrent ₦600 requests against a ₦1,000 balance: exactly one succeeds', async () => {
    const state = freshState({ earnings: [{ earning_kobo: 100000, status: 'unpaid' }] }); // ₦1,000

    const [a, b] = await Promise.all([
      Promise.resolve(keeperRequestWithdrawal(state, 60000)),
      Promise.resolve(keeperRequestWithdrawal(state, 60000)),
    ]);

    const okCount = [a, b].filter((r) => r.ok).length;
    expect(okCount).toBe(1);
    expect(state.payouts.reduce((s, p) => s + p.amount_kobo, 0)).toBe(60000);
  });

  it('ten concurrent ₦150 requests against a ₦1,000 balance: exactly six succeed, reserved never exceeds balance', async () => {
    const state = freshState({ earnings: [{ earning_kobo: 100000, status: 'unpaid' }] }); // ₦1,000

    const outcomes = await Promise.all(
      Array.from({ length: 10 }, () => Promise.resolve(keeperRequestWithdrawal(state, 15000))), // ₦150 each
    );

    const okCount = outcomes.filter((o) => o.ok).length;
    const insufficientCount = outcomes.filter((o) => !o.ok && o.reason === 'insufficient').length;

    expect(okCount).toBe(6); // floor(100000 / 15000)
    expect(insufficientCount).toBe(4);
    const reserved = state.payouts.reduce((s, p) => s + p.amount_kobo, 0);
    expect(reserved).toBe(90000);
    expect(reserved).toBeLessThanOrEqual(100000);
  });

  it('a pending withdrawal reserves funds immediately — a second call sees the reduced balance, not the original', () => {
    const state = freshState({ earnings: [{ earning_kobo: 100000, status: 'unpaid' }] });

    const first = keeperRequestWithdrawal(state, 70000);
    expect(first).toMatchObject({ ok: true });
    // The reserved row is 'pending' — never touched again by the withdraw
    // route until the transfer webhook resolves it — yet it already counts.
    expect(state.payouts[0].status).toBe('pending');

    const second = keeperRequestWithdrawal(state, 40000); // only 30000 left
    expect(second).toMatchObject({ ok: false, reason: 'insufficient', available_kobo: 30000 });
  });
});

// ─── Refund-after-withdrawal: negative balance carries forward and blocks further withdrawals ──

describe('keeper_request_withdrawal (ported) — refund after withdrawal', () => {
  it('a refund that zeroes an already-withdrawn-against earning drives available negative, and ANY further withdrawal is blocked', () => {
    // Keeper withdrew ₦2,000 against a ₦2,000 earning. A refund then zeroes
    // that earning (adjustEarningForRefund never claws back a 'pending' /
    // in-flight keeper withdrawal — see earningsService.ts) — the earning
    // row itself is what changes, not the payout.
    const state = freshState({
      earnings: [{ earning_kobo: 0, status: 'refunded' }], // was 200000, now refunded to 0
      payouts: [{ amount_kobo: 200000, status: 'success', requested_by: 'keeper' }],
    });

    // available = 0 - 200000 = -200000, carried forward (nothing resets it).
    const probe = keeperRequestWithdrawal(state, 999_999_999);
    expect((probe as { available_kobo: number }).available_kobo).toBe(-200000);

    // Even the smallest possible withdrawal (1 kobo) must be blocked while negative.
    const r = keeperRequestWithdrawal(state, 1);
    expect(r).toMatchObject({ ok: false, reason: 'insufficient', available_kobo: -200000 });

    // No new reservation was created by the blocked attempt.
    expect(state.payouts).toHaveLength(1);
  });

  it('a partial refund that shrinks (not zeroes) an earning still blocks withdrawals once it dips negative', () => {
    const state = freshState({
      earnings: [{ earning_kobo: 50000, status: 'unpaid' }], // was 200000, refund scaled it down to 50000
      payouts: [{ amount_kobo: 200000, status: 'success', requested_by: 'keeper' }],
    });
    // available = 50000 - 200000 = -150000

    const r = keeperRequestWithdrawal(state, 100);
    expect(r).toMatchObject({ ok: false, reason: 'insufficient', available_kobo: -150000 });
  });
});
