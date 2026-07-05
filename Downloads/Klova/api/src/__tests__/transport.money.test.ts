import { vi, describe, it, expect, beforeEach } from 'vitest';

// Gaps not caught by narrower service tests:
//   1. Commission / GBV  — earningsService never touches transport_fare
//   2. Payout formula    — clean earnings + transport only when status='paid'
//
// Already verified elsewhere (not duplicated here):
//   • Dispatch gate      — all 5 transport statuses  → dispatchService.test.ts
//   • Webhook isolation  — clean ↔ transport paths   → webhookController.test.ts
//   • Deadline cancel    — overdue detection + slot-free → transportCancellationService.test.ts

vi.mock('../config', () => ({
  config: { commissionRate: 0.22, paystackSecretKey: 'sk_test_fake' },
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from '../lib/supabase';
import { recordEarning } from '../services/earningsService';

// ─── Chain helper ─────────────────────────────────────────────────────────────

function chain(result: { data: unknown; error: unknown }) {
  const b: any = {};
  b.then = (resolve: (v: any) => any, reject?: (v: any) => any) =>
    Promise.resolve(result).then(resolve, reject);
  b.catch = (fn: (v: any) => any) => Promise.resolve(result).catch(fn);
  b.single = vi.fn().mockResolvedValue(result);
  b.maybeSingle = vi.fn().mockResolvedValue(result);
  for (const m of ['select', 'eq', 'update', 'upsert', 'insert', 'in', 'order', 'is', 'gt', 'not']) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  return b;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Section 1: Commission / GBV ─────────────────────────────────────────────
//
// earningsService.recordEarning computes:
//   cleaningFeeKobo = base_amount_kobo + addons_amount_kobo
//   keeperEarning   = cleaningFeeKobo − (commission_kobo − insurance_amount_kobo)
//
// transport_fare is not in the SELECT clause and plays no role in this formula.
// The keeper's earning is identical whether transport_fare is ₦0, ₦2,000, or ₦50,000.

const BOOKING_ID = 'bk-money-001';
const CLEANER_ID = 'cl-money-001';

// ── Helper: one-keeper booking_cleaners chain ────────────────────────────────
// recordEarning now makes 3 from() calls: booking → booking_cleaners → earnings.
const KEEPERS_1 = chain({ data: [{ cleaner_id: CLEANER_ID }], error: null });

describe('recordEarning — transport_fare excluded from keeper earning (Commission / GBV)', () => {
  it('2-bed Standard Clean: keeper earns 78% of cleaning fee regardless of transport_fare', async () => {
    // base ₦9,500; commission = Math.round(950_000 × 0.22) = 209_000 kobo
    // keeper earning = 950_000 − 209_000 = 741_000 kobo = ₦7,410
    // The real booking row has transport_fare=2000 but earningsService never selects it.
    const bookingChain  = chain({ data: {
      base_amount_kobo:      950_000,
      addons_amount_kobo:    0,
      insurance_amount_kobo: 0,
      commission_kobo:       209_000,
      total_amount_kobo:     950_000,
      refund_kobo:           0,
    }, error: null });
    const earningsChain = chain({ data: null, error: null });

    vi.mocked(supabase.from)
      .mockReturnValueOnce(bookingChain as any)
      .mockReturnValueOnce(KEEPERS_1 as any)
      .mockReturnValueOnce(earningsChain as any);

    await recordEarning(BOOKING_ID);

    const rows = earningsChain.upsert.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows[0].earning_kobo).toBe(741_000);    // ₦7,410 — unaffected by transport
    expect(rows[0].status).toBe('unpaid');
    expect('transport_fare' in rows[0]).toBe(false); // transport must never appear here
  });

  it('insurance is 100% Klova revenue — keeper earning uses cleaning fee only', async () => {
    // 1-bed Standard ₦5,000 + insurance ₦1,300
    // commission = Math.round(500_000 × 0.22) + 130_000 = 110_000 + 130_000 = 240_000
    // cleaningCommission = 240_000 − 130_000 = 110_000
    // keeper earning = 500_000 − 110_000 = 390_000 kobo = ₦3,900
    const bookingChain  = chain({ data: {
      base_amount_kobo:      500_000,
      addons_amount_kobo:    0,
      insurance_amount_kobo: 130_000,
      commission_kobo:       240_000,
      total_amount_kobo:     630_000,
      refund_kobo:           0,
    }, error: null });
    const earningsChain = chain({ data: null, error: null });

    vi.mocked(supabase.from)
      .mockReturnValueOnce(bookingChain as any)
      .mockReturnValueOnce(KEEPERS_1 as any)
      .mockReturnValueOnce(earningsChain as any);

    await recordEarning(BOOKING_ID);

    const rows = earningsChain.upsert.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows[0].earning_kobo).toBe(390_000);    // ₦3,900
    expect('transport_fare' in rows[0]).toBe(false);
  });

  it('add-ons flow into keeper earning; transport_fare has no effect', async () => {
    // 2-bed Standard ₦9,500 + Laundry ₦3,500 = cleaning fee ₦13,000
    // commission = Math.round(1_300_000 × 0.22) = 286_000 kobo
    // keeper earning = 1_300_000 − 286_000 = 1_014_000 kobo = ₦10,140
    const bookingChain  = chain({ data: {
      base_amount_kobo:      950_000,
      addons_amount_kobo:    350_000,
      insurance_amount_kobo: 0,
      commission_kobo:       286_000,
      total_amount_kobo:     1_300_000,
      refund_kobo:           0,
    }, error: null });
    const earningsChain = chain({ data: null, error: null });

    vi.mocked(supabase.from)
      .mockReturnValueOnce(bookingChain as any)
      .mockReturnValueOnce(KEEPERS_1 as any)
      .mockReturnValueOnce(earningsChain as any);

    await recordEarning(BOOKING_ID);

    const rows = earningsChain.upsert.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows[0].earning_kobo).toBe(1_014_000);  // ₦10,140
    expect('transport_fare' in rows[0]).toBe(false);
  });

  it('booking not found → throws without upsert', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({ data: null, error: { message: 'not found' } }) as any,
    );
    await expect(recordEarning('missing')).rejects.toThrow();
    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(1); // no upsert
  });
});

// ─── Section 1b: 2-keeper even split ─────────────────────────────────────────
//
// For a 2-keeper booking the total keeper earning is split 50/50.
// Any remainder kobo goes deterministically to the lead keeper (index 0 in the
// role-ASC order from booking_cleaners) so that the sum is exact to the kobo.
// Insurance and transport are not part of this split (excluded by the formula
// and the booking_cleaners.transport_fare_kobo column respectively).

const LEAD_ID   = 'keeper-lead-01';
const SECOND_ID = 'keeper-second-01';
const KEEPERS_2 = chain({ data: [{ cleaner_id: LEAD_ID }, { cleaner_id: SECOND_ID }], error: null });

describe('recordEarning — 2-keeper booking splits earning evenly', () => {
  it('records two rows summing exactly to the single total', async () => {
    // 2-bed Standard × 2 keepers: base_amount_kobo = 1_900_000 (pricingService doubles it)
    // cleaning fee = ₦19,000 = 1_900_000 kobo
    // commission   = Math.round(1_900_000 × 0.22) = 418_000 kobo
    // total earning = 1_900_000 − 418_000 = 1_482_000 kobo
    // per keeper   = 1_482_000 / 2 = 741_000 (no remainder)
    const bookingChain  = chain({ data: {
      base_amount_kobo:      1_900_000,
      addons_amount_kobo:    0,
      insurance_amount_kobo: 0,
      commission_kobo:       418_000,
      total_amount_kobo:     1_900_000,
      refund_kobo:           0,
    }, error: null });
    const earningsChain = chain({ data: null, error: null });

    vi.mocked(supabase.from)
      .mockReturnValueOnce(bookingChain as any)
      .mockReturnValueOnce(KEEPERS_2 as any)
      .mockReturnValueOnce(earningsChain as any);

    await recordEarning(BOOKING_ID);

    const rows = earningsChain.upsert.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);

    const sum = rows.reduce((s, r) => s + (r.earning_kobo as number), 0);
    expect(sum).toBe(1_482_000);                 // exact to the kobo
    expect(rows[0].cleaner_id).toBe(LEAD_ID);
    expect(rows[1].cleaner_id).toBe(SECOND_ID);
    expect(rows[0].earning_kobo).toBe(741_000);  // lead
    expect(rows[1].earning_kobo).toBe(741_000);  // second
    expect(rows[0].status).toBe('unpaid');
    expect(rows[1].status).toBe('unpaid');
    expect('transport_fare' in rows[0]).toBe(false);
    expect('transport_fare' in rows[1]).toBe(false);
  });

  it('assigns the remainder kobo to the lead keeper so the sum is exact', async () => {
    // Odd cleaning fee produces a remainder of 1 kobo after halving.
    // cleaning fee = 950_000 + 10_001 = 960_001 kobo
    // commission   = Math.round(960_001 × 0.22) = Math.round(211_200.22) = 211_200 kobo
    // total earning = 960_001 − 211_200 = 748_801 kobo
    // per keeper   = floor(748_801 / 2) = 374_400   remainder = 1
    // lead gets 374_401,  second gets 374_400
    const bookingChain  = chain({ data: {
      base_amount_kobo:      950_000,
      addons_amount_kobo:    10_001,
      insurance_amount_kobo: 0,
      commission_kobo:       211_200,
      total_amount_kobo:     960_001,
      refund_kobo:           0,
    }, error: null });
    const earningsChain = chain({ data: null, error: null });

    vi.mocked(supabase.from)
      .mockReturnValueOnce(bookingChain as any)
      .mockReturnValueOnce(KEEPERS_2 as any)
      .mockReturnValueOnce(earningsChain as any);

    await recordEarning(BOOKING_ID);

    const rows = earningsChain.upsert.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);

    const sum = rows.reduce((s, r) => s + (r.earning_kobo as number), 0);
    expect(sum).toBe(748_801);                   // exact to the kobo
    expect(rows[0].earning_kobo).toBe(374_401);  // lead gets remainder
    expect(rows[1].earning_kobo).toBe(374_400);  // second
  });
});

// ─── Section 2: Payout formula — transport counted only when status='paid' ────
//
// Keeper weekly total:
//   total_payout_ngn = (Σ clean_earning_kobo / 100)
//                    + (Σ transport_fare where transport_status = 'paid')
//
// Transport reimbursement is pass-through — never multiplied by (1 − commission_rate).
// Any status other than 'paid' contributes ₦0 to the transport column.

function keeperWeeklyTotal(
  bookings: Array<{ clean_kobo: number; transport_ngn: number; transport_status: string }>,
): number {
  const cleanNgn     = bookings.reduce((s, b) => s + b.clean_kobo, 0) / 100;
  const transportNgn = bookings.reduce(
    (s, b) => (b.transport_status === 'paid' ? s + b.transport_ngn : s),
    0,
  );
  return cleanNgn + transportNgn;
}

describe('keeperWeeklyTotal — payout formula (Payout)', () => {
  it('paid transport is added in full — never discounted by commission', () => {
    const total = keeperWeeklyTotal([
      { clean_kobo: 741_000, transport_ngn: 2_000, transport_status: 'paid' },
    ]);
    // ₦7,410 clean + ₦2,000 transport = ₦9,410
    expect(total).toBe(9_410);
  });

  it('awaiting_payment transport contributes ₦0', () => {
    const total = keeperWeeklyTotal([
      { clean_kobo: 741_000, transport_ngn: 2_000, transport_status: 'awaiting_payment' },
    ]);
    expect(total).toBe(7_410); // clean only
  });

  it('waived and not_required transport both contribute ₦0', () => {
    const waivedTotal      = keeperWeeklyTotal([{ clean_kobo: 500_000, transport_ngn: 1_500, transport_status: 'waived' }]);
    const notRequiredTotal = keeperWeeklyTotal([{ clean_kobo: 500_000, transport_ngn: 1_500, transport_status: 'not_required' }]);
    expect(waivedTotal).toBe(5_000);
    expect(notRequiredTotal).toBe(5_000);
  });

  it('multi-booking: sums all clean earnings; only paid transport counts', () => {
    const total = keeperWeeklyTotal([
      { clean_kobo: 741_000, transport_ngn: 2_000, transport_status: 'paid' },           // ₦9,410
      { clean_kobo: 390_000, transport_ngn: 3_500, transport_status: 'awaiting_payment' }, // ₦3,900
      { clean_kobo: 1_014_000, transport_ngn: 1_800, transport_status: 'waived' },        // ₦10,140
    ]);
    // clean: (741_000 + 390_000 + 1_014_000) / 100 = ₦21,450
    // transport: ₦2,000 (only first booking)
    // total: ₦23,450
    expect(total).toBe(23_450);
  });

  it('empty booking list returns 0', () => {
    expect(keeperWeeklyTotal([])).toBe(0);
  });

  it('refunded transport does not count toward payout', () => {
    const total = keeperWeeklyTotal([
      { clean_kobo: 741_000, transport_ngn: 2_000, transport_status: 'refunded' },
    ]);
    expect(total).toBe(7_410); // clean only; transport was refunded so Klova absorbs it
  });
});

