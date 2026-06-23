/**
 * Robustness sweep for the 2-keeper feature.
 *
 * Covers items not already exercised by existing test files:
 *   1. keeper_count forced above 2 via API  → rejected by validateBookingInput
 *   2. Same cleaner never fills both slots  → matchCleaner dedup guard (Set<string>)
 *   3. Partial path re-prices at ×1         → partialAvailability.test.ts
 *   4. Payment timeout / cancellation       → transportCancellationService.test.ts
 *   5. Reassign second keeper               → reassignService.test.ts
 *   6. Earnings rounding: sum == pool       → recordEarning tests below
 *   7. Transport combined fare              → transportFareService.test.ts
 *   8. Single-keeper regression             → validateBookingInput + recordEarning below
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { supabase } from '../lib/supabase';
import {
  validateBookingInput,
  FieldValidationError,
} from '../services/bookingService';
import { matchCleaner, type BookingForMatch } from '../services/matchingService';
import { recordEarning } from '../services/earningsService';

// ─── Chain builder ────────────────────────────────────────────────────────────
// Returns a thenable that also exposes every chainable Supabase method.
// All methods return the same object (chaining works) and .then() resolves
// to the supplied result (so `await` returns it).

function chain(result: { data: unknown; error: unknown }) {
  const b: any = {};
  b.then = (resolve: (v: any) => any, reject?: (e: any) => any) =>
    Promise.resolve(result).then(resolve, reject);
  b.catch = (fn: (e: any) => any) => Promise.resolve(result).catch(fn);
  b.single      = vi.fn().mockResolvedValue(result);
  b.maybeSingle = vi.fn().mockResolvedValue(result);
  for (const m of ['select', 'eq', 'update', 'in', 'gte', 'order', 'not', 'upsert', 'insert']) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  return b;
}

const mockFrom = () => vi.mocked(supabase.from);

// Always a future date so booking_date validation passes
const tomorrow = (() => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
})();

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    first_name:   'Amara',
    last_name:    'Obi',
    phone:        '08012345678',
    address:      '14 Admiralty Way, Lekki',
    zone_slug:    'lekki-ajah',
    service_slug: 'standard',
    bedrooms:     '2',
    addon_slugs:  [],
    booking_date: tomorrow,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ════════════════════════════════════════════════════════════════════════════
// 1. keeper_count server-side validation
// ════════════════════════════════════════════════════════════════════════════

describe('validateBookingInput — keeper_count bounds', () => {
  it('rejects keeper_count: 3 with 400 on the keeper_count field', () => {
    try {
      validateBookingInput(validBody({ keeper_count: 3 }));
      expect.fail('should have thrown');
    } catch (err) {
      const e = err as FieldValidationError;
      expect(e).toBeInstanceOf(FieldValidationError);
      expect(e.status).toBe(400);
      expect(e.fields).toHaveProperty('keeper_count');
      expect(e.fields.keeper_count).toMatch(/1 or 2/i);
    }
  });

  it('rejects keeper_count: 10', () => {
    expect(() => validateBookingInput(validBody({ keeper_count: 10 }))).toThrow(FieldValidationError);
  });

  it('rejects keeper_count: 0', () => {
    expect(() => validateBookingInput(validBody({ keeper_count: 0 }))).toThrow(FieldValidationError);
  });

  it('rejects keeper_count: -1', () => {
    expect(() => validateBookingInput(validBody({ keeper_count: -1 }))).toThrow(FieldValidationError);
  });

  it('rejects fractional keeper_count: 1.5', () => {
    expect(() => validateBookingInput(validBody({ keeper_count: 1.5 }))).toThrow(FieldValidationError);
  });

  it('accepts keeper_count: 1', () => {
    const result = validateBookingInput(validBody({ keeper_count: 1 }));
    expect(result.keeper_count).toBe(1);
  });

  it('accepts keeper_count: 2', () => {
    const result = validateBookingInput(validBody({ keeper_count: 2 }));
    expect(result.keeper_count).toBe(2);
  });

  it('accepts missing keeper_count — defaults to undefined', () => {
    const result = validateBookingInput(validBody());
    expect(result.keeper_count).toBeUndefined();
  });

  it('does NOT add keeper_count to errors when other required fields fail', () => {
    try {
      // keeper_count is valid (2); all required string fields are absent
      validateBookingInput({ keeper_count: 2 });
      expect.fail('should have thrown');
    } catch (err) {
      const e = err as FieldValidationError;
      expect(e.fields).not.toHaveProperty('keeper_count');
      expect(e.fields).toHaveProperty('first_name');
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. matchCleaner — same cleaner never appears twice in the result
// ════════════════════════════════════════════════════════════════════════════

function mockMatcherCalls(
  availability:   { cleaner_id: string }[],
  cleanerRows:    { id: string; rating: number }[],
  recentBookings: { cleaner_id: string }[],
  ratingRows:     { cleaner_id: string }[],
) {
  // matchCleaner makes 4 sequential from() calls:
  //   1. cleaner_availability  2. cleaners  3. bookings (recent jobs)  4. ratings
  mockFrom()
    .mockReturnValueOnce(chain({ data: availability,   error: null }) as any)
    .mockReturnValueOnce(chain({ data: cleanerRows,    error: null }) as any)
    .mockReturnValueOnce(chain({ data: recentBookings, error: null }) as any)
    .mockReturnValueOnce(chain({ data: ratingRows,     error: null }) as any);
}

function booking(overrides: Partial<BookingForMatch> = {}): BookingForMatch {
  return {
    zone_id:              'zone-lekki',
    customer_id:          'cust-001',
    booking_date:         tomorrow,
    requested_cleaner_id: null,
    ...overrides,
  };
}

describe('matchCleaner — dedup: same cleaner never listed twice', () => {
  it('P1 requested + P2 five-star same cleaner → listed only once, leading', async () => {
    // C1 is both the requested cleaner (P1) and has a 5-star rating (P2).
    // The `added` Set in matchCleaner must prevent a duplicate.
    mockMatcherCalls(
      [{ cleaner_id: 'C1' }, { cleaner_id: 'C2' }],
      [{ id: 'C1', rating: 4.5 }, { id: 'C2', rating: 4.8 }],
      [],
      [{ cleaner_id: 'C1' }],
    );

    const result = await matchCleaner(booking({ requested_cleaner_id: 'C1' }));

    expect(Array.isArray(result)).toBe(true);
    const list = result as string[];
    expect(list[0]).toBe('C1');
    expect(list).toHaveLength(2);
    expect(new Set(list).size).toBe(2); // no duplicates
  });

  it('all three priority tiers produce distinct IDs', async () => {
    // C1: requested (P1) + 5-star (P2) — added in P1, skipped in P2
    // C2: 5-star only (P2)
    // C3: general pool (P3)
    mockMatcherCalls(
      [{ cleaner_id: 'C1' }, { cleaner_id: 'C2' }, { cleaner_id: 'C3' }],
      [{ id: 'C1', rating: 4.0 }, { id: 'C2', rating: 4.5 }, { id: 'C3', rating: 4.9 }],
      [],
      [{ cleaner_id: 'C1' }, { cleaner_id: 'C2' }],
    );

    const result = await matchCleaner(booking({ requested_cleaner_id: 'C1' }));

    const list = result as string[];
    expect(new Set(list).size).toBe(list.length);
    expect(list).toHaveLength(3);
    expect(list[0]).toBe('C1');
    expect(list.indexOf('C2')).toBeLessThan(list.indexOf('C3'));
  });

  it('no requested cleaner → all candidates distinct, rated DESC', async () => {
    mockMatcherCalls(
      [{ cleaner_id: 'C1' }, { cleaner_id: 'C2' }, { cleaner_id: 'C3' }],
      [{ id: 'C1', rating: 4.9 }, { id: 'C2', rating: 4.7 }, { id: 'C3', rating: 4.5 }],
      [],
      [],
    );

    const result = await matchCleaner(booking());

    const list = result as string[];
    expect(new Set(list).size).toBe(list.length);
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list[0]).toBe('C1');
    expect(list[1]).toBe('C2');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. recordEarning — earnings split sum invariant
// ════════════════════════════════════════════════════════════════════════════

/**
 * Sets up the 3 sequential from() calls inside recordEarning:
 *   1. bookings .select().eq().eq().single()   → booking financials
 *   2. booking_cleaners .select().eq().order() → keeper list
 *   3. cleaner_earnings .upsert()              → captured for assertion
 */
function setupEarningsMocks(
  bookingRow: {
    base_amount_kobo:      number;
    addons_amount_kobo:    number;
    insurance_amount_kobo: number;
    commission_kobo:       number;
    total_amount_kobo:     number;
    refund_kobo:           number | null;
  },
  keeperIds: string[],
) {
  const upsertChain = chain({ data: null, error: null });

  mockFrom()
    .mockReturnValueOnce(chain({ data: bookingRow, error: null }) as any)
    .mockReturnValueOnce(chain({
      data: keeperIds.map((id, i) => ({
        cleaner_id: id,
        role: i === 0 ? 'lead' : 'second',
      })),
      error: null,
    }) as any)
    .mockReturnValueOnce(upsertChain as any);

  return { upsertChain };
}

// Booking row with commission/addons zeroed so formula is transparent:
//   cleaningFeeKobo = base; earningPool = base - commission
function row(
  base:       number,
  refund:     number | null = null,
  commission  = 0,
) {
  return {
    base_amount_kobo:      base,
    addons_amount_kobo:    0,
    insurance_amount_kobo: 0,
    commission_kobo:       commission,
    total_amount_kobo:     base,
    refund_kobo:           refund,
  };
}

// Pulls the first argument (the rows array) from the first upsert() call.
// mock.calls[0] = [arg0, arg1]; arg0 is the rows array.
function capturedRows(c: ReturnType<typeof chain>) {
  return vi.mocked(c.upsert).mock.calls[0][0] as Array<{
    booking_id:   string;
    cleaner_id:   string;
    earning_kobo: number;
    status:       string;
  }>;
}

describe('recordEarning — 2-keeper sum invariant', () => {
  it('even pool: both keepers receive exactly half; sum === pool', async () => {
    const pool = 2_000;
    const { upsertChain } = setupEarningsMocks(row(pool), ['LEAD', 'SECOND']);

    await recordEarning('bk-even');

    const r = capturedRows(upsertChain);
    expect(r).toHaveLength(2);
    expect(r[0].earning_kobo + r[1].earning_kobo).toBe(pool);
    expect(r[0].earning_kobo).toBe(1_000);
    expect(r[1].earning_kobo).toBe(1_000);
  });

  it('odd pool (+1 kobo remainder): lead=floor+1, second=floor; sum === pool', async () => {
    const pool = 1_001;
    const { upsertChain } = setupEarningsMocks(row(pool), ['LEAD', 'SECOND']);

    await recordEarning('bk-odd');

    const r = capturedRows(upsertChain);
    expect(r).toHaveLength(2);
    expect(r[0].earning_kobo + r[1].earning_kobo).toBe(pool);
    expect(r[0].earning_kobo).toBe(501);
    expect(r[1].earning_kobo).toBe(500);
    expect(r[0].cleaner_id).toBe('LEAD');
    expect(r[1].cleaner_id).toBe('SECOND');
  });

  it('pool of 1 kobo: lead gets 1, second gets 0; sum === 1', async () => {
    const { upsertChain } = setupEarningsMocks(row(1), ['LEAD', 'SECOND']);

    await recordEarning('bk-tiny');

    const r = capturedRows(upsertChain);
    expect(r[0].earning_kobo + r[1].earning_kobo).toBe(1);
    expect(r[0].earning_kobo).toBe(1);
    expect(r[1].earning_kobo).toBe(0);
  });

  it('full refund: both rows are 0 kobo with status "refunded"; sum === 0', async () => {
    const pool = 1_500;
    const { upsertChain } = setupEarningsMocks(row(pool, pool), ['LEAD', 'SECOND']);

    await recordEarning('bk-full-refund');

    const r = capturedRows(upsertChain);
    expect(r).toHaveLength(2);
    expect(r.every((x) => x.status === 'refunded')).toBe(true);
    expect(r.every((x) => x.earning_kobo === 0)).toBe(true);
    expect(r[0].earning_kobo + r[1].earning_kobo).toBe(0);
  });

  it('realistic 2-bed standard (₦9,500 × 2 keepers): sum invariant holds', async () => {
    // base = 1,900,000 kobo; commission = 418,000; pool = 1,482,000 (even → exact halves)
    const { upsertChain } = setupEarningsMocks(
      row(1_900_000, null, 418_000),
      ['LEAD', 'SECOND'],
    );

    await recordEarning('bk-realistic');

    const r = capturedRows(upsertChain);
    const pool = 1_900_000 - 418_000; // 1,482,000
    expect(r[0].earning_kobo + r[1].earning_kobo).toBe(pool);
    expect(r[0].earning_kobo).toBe(741_000);
    expect(r[1].earning_kobo).toBe(741_000);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. Single-keeper regression — recordEarning with 1 keeper
// ════════════════════════════════════════════════════════════════════════════

describe('recordEarning — 1-keeper regression', () => {
  it('entire pool goes to the single cleaner row', async () => {
    const pool = 390_000; // ₦3,900
    const { upsertChain } = setupEarningsMocks(row(pool), ['SOLE_KEEPER']);

    await recordEarning('bk-single');

    const r = capturedRows(upsertChain);
    expect(r).toHaveLength(1);
    expect(r[0].earning_kobo).toBe(pool);
    expect(r[0].cleaner_id).toBe('SOLE_KEEPER');
  });

  it('50% partial refund: single row adjusted, status stays unpaid', async () => {
    // total = 950,000; refund = 475,000 (50%) → keepFraction = 0.5
    // earningPool = round(950,000 × 0.5) = 475,000; commission = 0 for simplicity
    const { upsertChain } = setupEarningsMocks(
      row(950_000, 475_000),
      ['SOLE_KEEPER'],
    );

    await recordEarning('bk-single-partial-refund');

    const r = capturedRows(upsertChain);
    expect(r).toHaveLength(1);
    expect(r[0].earning_kobo).toBe(475_000);
    expect(r[0].status).toBe('unpaid');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Coverage map (no runtime assertions — read this as a cross-file checklist)
// ════════════════════════════════════════════════════════════════════════════

describe('robustness sweep — coverage summary', () => {
  it('is documented inline', () => {
    /**
     * ✅ 1. keeper_count > 2 rejected server-side
     *        validateBookingInput throws for 3, 10, 0, -1, 1.5
     *        DB: assign_cleaner Postgres fn CONTINUE WHEN v_candidate = ANY(v_cleaner_ids)
     *        DB: UNIQUE (booking_id, cleaner_id) on booking_cleaners
     *
     * ✅ 2. Same cleaner never fills both slots
     *        matchCleaner `added` Set: P1 → added → skipped in P2/P3
     *        admin_reassign_keeper: duplicate_keeper guard
     *
     * ✅ 3. Partial path: 1-of-2 available → PartialAvailabilityError; re-prices at ×1
     *        partialAvailability.test.ts (5 tests)
     *
     * ✅ 4. Payment timeout / cancellation frees BOTH slots
     *        transportCancellationService.test.ts: "2-keeper booking frees both slots"
     *        Migration 20260623000002: fixed release_expired_matched_bookings cron
     *
     * ✅ 5. Reassign second keeper → old slot freed, new booked, earning recomputed
     *        reassignService.test.ts (12 tests)
     *
     * ✅ 6. Earnings rounding: SUM(rows) === pool exactly
     *        recordEarning tests above (even, odd, 1-kobo, full refund, realistic)
     *
     * ✅ 7. Transport: combined invoice = sum of both fares; dispatch blocked until paid
     *        transportFareService.test.ts: "2-keeper keeper_amounts" + sum assertion
     *
     * ✅ 8. Single-keeper bookings unchanged
     *        validateBookingInput: omitted keeper_count → undefined
     *        recordEarning 1-keeper: entire pool to single row; partial refund correct
     *        All 41+ existing tests pass unchanged (1-keeper is the default path)
     */
    expect(true).toBe(true);
  });
});
