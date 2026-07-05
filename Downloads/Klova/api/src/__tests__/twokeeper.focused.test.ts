/**
 * Focused tests for the highest-risk two-keeper logic.
 *
 * Sections:
 *   A. assignCleaner   — all-or-nothing RPC contract + 2-keeper concurrency race
 *   B. earningsService — 2-keeper split with insurance present
 *   C. getBookingStatus — response shape (2 profiles / 1 profile / 0 before dispatch)
 *
 * Matching priority-order and dedup are already covered by:
 *   matchingService.test.ts (P1/P2/P3 ordering, NO_MATCH paths)
 *   robustness.twokeeper.test.ts (P1+P2 dedup, keeper_count bounds)
 *
 * NOTE: vi.resetAllMocks() is used in beforeEach (not clearAllMocks) so that
 * the mockReturnValueOnce queue is fully drained between tests. clearAllMocks
 * only clears .mock.calls/results, not the once-queue.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

// matchingService is mocked so assignCleaner tests control the candidate list.
vi.mock('../services/matchingService', () => ({
  NO_MATCH: 'NO_MATCH',
  matchCleaner: vi.fn(),
}));

import { supabase } from '../lib/supabase';
import { matchCleaner } from '../services/matchingService';
import { assignCleaner } from '../services/assignmentService';
import { recordEarning } from '../services/earningsService';
import { getBookingStatus } from '../services/bookingService';

// ─── Chain helper ─────────────────────────────────────────────────────────────
// Returns a thenable that exposes every chainable Supabase builder method.

function chain(result: { data: unknown; error: unknown }) {
  const b: any = {};
  b.then = (resolve: (v: any) => any, reject?: (e: any) => any) =>
    Promise.resolve(result).then(resolve, reject);
  b.catch = (fn: (e: any) => any) => Promise.resolve(result).catch(fn);
  b.single      = vi.fn().mockResolvedValue(result);
  b.maybeSingle = vi.fn().mockResolvedValue(result);
  for (const m of [
    'select', 'eq', 'update', 'in', 'gte', 'order', 'not',
    'upsert', 'insert', 'is', 'gt', 'lt',
  ]) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  return b;
}

const mockFrom  = () => vi.mocked(supabase.from);
const mockRpc   = () => vi.mocked(supabase.rpc);
const mockMatch = () => vi.mocked(matchCleaner);

const DATE = '2026-09-01';
const ZONE = 'zone-lekki';
const CUST = 'cust-001';

function bookingCtx(overrides: Partial<import('../services/matchingService').BookingForMatch> = {}) {
  return {
    zone_id:              ZONE,
    customer_id:          CUST,
    booking_date:         DATE,
    requested_cleaner_id: null as string | null,
    ...overrides,
  };
}

beforeEach(() => {
  // resetAllMocks clears the mockReturnValueOnce queue as well as call history.
  // clearAllMocks leaves the queue intact, which poisons subsequent tests.
  vi.resetAllMocks();
});

// ════════════════════════════════════════════════════════════════════════════
// A. assignCleaner — all-or-nothing RPC contract + 2-keeper concurrency race
// ════════════════════════════════════════════════════════════════════════════
//
// The Postgres assign_cleaner function is all-or-nothing: it reserves exactly
// keeper_count slots or none. assignCleaner now also guards this at the
// application layer, treating a partial response as no_match.

describe('assignCleaner — all-or-nothing RPC contract', () => {
  it('2-keeper: RPC returns 2 distinct IDs → cleanerIds has exactly 2 entries', async () => {
    mockMatch().mockResolvedValueOnce(['c1', 'c2', 'c3']);
    mockRpc().mockResolvedValueOnce({ data: 'matched:c1,c2', error: null } as any);

    const result = await assignCleaner('bk-two', bookingCtx({ keeper_count: 2 }));

    expect(result.outcome).toBe('matched');
    expect((result as any).cleanerIds).toHaveLength(2);
    expect((result as any).cleanerIds).toEqual(['c1', 'c2']);
  });

  it('2-keeper: both assigned IDs are distinct (same cleaner never fills both slots)', async () => {
    mockMatch().mockResolvedValueOnce(['c1', 'c2', 'c3']);
    mockRpc().mockResolvedValueOnce({ data: 'matched:c1,c2', error: null } as any);

    const result = await assignCleaner('bk-distinct', bookingCtx({ keeper_count: 2 }));

    expect(result.outcome).toBe('matched');
    const ids = (result as any).cleanerIds as string[];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('2-keeper: RPC returns only 1 ID → no_match (all-or-nothing application-layer guard)', async () => {
    // The Postgres fn guarantees all-or-nothing; we also guard at the app layer
    // so a protocol violation never causes a silent single-assignment on a 2-keeper booking.
    mockMatch().mockResolvedValueOnce(['c1', 'c2']);
    mockRpc().mockResolvedValueOnce({ data: 'matched:c1', error: null } as any);

    const result = await assignCleaner('bk-partial-rpc', bookingCtx({ keeper_count: 2 }));

    expect(result.outcome).toBe('no_match');
  });

  it('2-keeper: RPC returns 3 IDs for a 2-keeper request → no_match (count guard)', async () => {
    mockMatch().mockResolvedValueOnce(['c1', 'c2', 'c3']);
    mockRpc().mockResolvedValueOnce({ data: 'matched:c1,c2,c3', error: null } as any);

    const result = await assignCleaner('bk-over-count', bookingCtx({ keeper_count: 2 }));

    expect(result.outcome).toBe('no_match');
  });

  it('1-keeper: RPC returns 1 ID → matched (count guard does not fire for keeperCount=1)', async () => {
    mockMatch().mockResolvedValueOnce(['c1', 'c2']);
    mockRpc().mockResolvedValueOnce({ data: 'matched:c1', error: null } as any);

    const result = await assignCleaner('bk-one', bookingCtx({ keeper_count: 1 }));

    expect(result.outcome).toBe('matched');
    expect((result as any).cleanerIds).toEqual(['c1']);
  });

  it('2-keeper race: exactly one booking gets both slots; the other gets no_match', async () => {
    // Pool: c1, c2, c3 — enough for ONE 2-keeper booking.
    // The Postgres fn is atomic: winner locks c1+c2, loser finds both taken.
    mockMatch()
      .mockResolvedValueOnce(['c1', 'c2', 'c3'])
      .mockResolvedValueOnce(['c1', 'c2', 'c3']);
    mockRpc()
      .mockResolvedValueOnce({ data: 'matched:c1,c2', error: null } as any)
      .mockResolvedValueOnce({ data: 'no_match',     error: null } as any);

    const [resA, resB] = await Promise.all([
      assignCleaner('bk-race-A', bookingCtx({ keeper_count: 2 })),
      assignCleaner('bk-race-B', bookingCtx({ keeper_count: 2 })),
    ]);

    const outcomes = [resA.outcome, resB.outcome].sort();
    expect(outcomes).toEqual(['matched', 'no_match']); // exactly one wins

    const winner = resA.outcome === 'matched' ? resA : resB;
    expect((winner as any).cleanerIds).toHaveLength(2); // winner holds BOTH slots — never a partial
  });

  it('2-keeper: RPC is called with p_keeper_count: 2 and the full candidate list', async () => {
    mockMatch().mockResolvedValueOnce(['c1', 'c2', 'c3']);
    mockRpc().mockResolvedValueOnce({ data: 'matched:c1,c2', error: null } as any);

    await assignCleaner('bk-args', bookingCtx({ keeper_count: 2 }));

    expect(mockRpc()).toHaveBeenCalledWith('assign_cleaner', {
      p_booking_id:    'bk-args',
      p_candidate_ids: ['c1', 'c2', 'c3'],
      p_booking_date:  DATE,
      p_keeper_count:  2,
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// B. earningsService — 2-keeper split with insurance present
// ════════════════════════════════════════════════════════════════════════════
//
// recordEarning formula:
//   cleaningFeeKobo    = base_amount_kobo + addons_amount_kobo
//   cleaningCommission = commission_kobo − insurance_amount_kobo
//   earningPool        = cleaningFeeKobo − cleaningCommission
//   per keeper         = floor(earningPool / keeperCount)
//   lead gets          = per keeper + (earningPool % keeperCount)
//
// Insurance is 100% Klova revenue: excluded from pool BEFORE the split.
// Transport is a pass-through via booking_cleaners (never in earning rows).

describe('recordEarning — 2-keeper split with insurance', () => {
  const LEAD   = 'keeper-lead';
  const SECOND = 'keeper-second';

  function setupMocks(bookingRow: Record<string, unknown>) {
    const upsertChain = chain({ data: null, error: null });
    mockFrom()
      .mockReturnValueOnce(chain({ data: bookingRow, error: null }) as any)
      .mockReturnValueOnce(chain({
        data: [
          { cleaner_id: LEAD,   role: 'lead'   },
          { cleaner_id: SECOND, role: 'second' },
        ],
        error: null,
      }) as any)
      .mockReturnValueOnce(upsertChain as any);
    return upsertChain;
  }

  it('insurance excluded from pool before split; two rows sum exactly to pool', async () => {
    // 2-bed Standard × 2 keepers + insurance:
    //   base             = 1_900_000 kobo  (₦19,000)
    //   insurance        =   260_000 kobo  (₦2,600)
    //   commission       =   418_000 kobo  (22% of cleaning fee)
    //   cleaningCommission = 418_000 − 260_000 = 158_000
    //   earningPool      = 1_900_000 − 158_000 = 1_742_000  (₦17,420)
    //   per keeper       = 871_000 each (no remainder)
    const upsertChain = setupMocks({
      base_amount_kobo:      1_900_000,
      addons_amount_kobo:    0,
      insurance_amount_kobo: 260_000,
      commission_kobo:       418_000,
      total_amount_kobo:     2_160_000,
      refund_kobo:           0,
    });

    await recordEarning('bk-ins-2k');

    const rows = upsertChain.upsert.mock.calls[0][0] as Array<{
      cleaner_id: string;
      earning_kobo: number;
      status: string;
    }>;

    expect(rows).toHaveLength(2);
    expect(rows[0].cleaner_id).toBe(LEAD);
    expect(rows[1].cleaner_id).toBe(SECOND);

    const expectedPool = 1_900_000 - (418_000 - 260_000); // 1_742_000
    expect(rows[0].earning_kobo + rows[1].earning_kobo).toBe(expectedPool); // exact sum
    expect(rows[0].earning_kobo).toBe(871_000);
    expect(rows[1].earning_kobo).toBe(871_000);
    expect(rows[0].status).toBe('unpaid');
    expect(rows[1].status).toBe('unpaid');

    // Transport must NEVER appear in earning rows
    expect('transport_fare' in rows[0]).toBe(false);
    expect('transport_fare' in rows[1]).toBe(false);
  });

  it('odd pool after insurance exclusion: lead absorbs 1-kobo remainder; sum exact', async () => {
    //   base             = 1_000_001 kobo
    //   insurance        =   100_000
    //   commission       =   220_000
    //   cleaningCommission = 220_000 − 100_000 = 120_000
    //   earningPool      = 1_000_001 − 120_000 = 880_001  (odd)
    //   lead             = floor(880_001/2) + 1 = 440_001
    //   second           = floor(880_001/2)     = 440_000
    const upsertChain = setupMocks({
      base_amount_kobo:      1_000_001,
      addons_amount_kobo:    0,
      insurance_amount_kobo: 100_000,
      commission_kobo:       220_000,
      total_amount_kobo:     1_100_001,
      refund_kobo:           0,
    });

    await recordEarning('bk-ins-odd');

    const rows = upsertChain.upsert.mock.calls[0][0] as Array<{ earning_kobo: number }>;
    const expectedPool = 1_000_001 - (220_000 - 100_000); // 880_001
    expect(rows[0].earning_kobo + rows[1].earning_kobo).toBe(expectedPool);
    expect(rows[0].earning_kobo).toBe(440_001); // lead absorbs the 1-kobo remainder
    expect(rows[1].earning_kobo).toBe(440_000);
  });

  it('zero commission: full cleaning fee split evenly between keepers', async () => {
    // Edge case: early seeding / test zone where commission_kobo = 0.
    // earningPool = base (100% to keepers).
    const pool = 2_000_000;
    const upsertChain = setupMocks({
      base_amount_kobo:      pool,
      addons_amount_kobo:    0,
      insurance_amount_kobo: 0,
      commission_kobo:       0,
      total_amount_kobo:     pool,
      refund_kobo:           0,
    });

    await recordEarning('bk-no-commission');

    const rows = upsertChain.upsert.mock.calls[0][0] as Array<{ earning_kobo: number }>;
    expect(rows[0].earning_kobo + rows[1].earning_kobo).toBe(pool);
    expect(rows[0].earning_kobo).toBe(1_000_000);
    expect(rows[1].earning_kobo).toBe(1_000_000);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// C. getBookingStatus — response shape
// ════════════════════════════════════════════════════════════════════════════
//
// getBookingStatus call sequence:
//   1. bookings .select(...).eq('id', id).maybeSingle()     → booking row
//   2. (dispatch cleared only) booking_cleaners .select(...).eq().order()
//   3. (assignedIds.length > 0) cleaners .select(...).in('id', ids)
//
// dispatch cleared = transport_status ∈ {'paid', 'waived', 'not_required'}
// cleaners array is ordered by booking_cleaners role ASC ('lead' < 'second')

function makeBookingRow(overrides: Partial<{
  keeper_count: number;
  transport_status: string;
  transport_fare: number | null;
}> = {}) {
  return {
    id:                    'bk-shape',
    status:                'confirmed',
    keeper_count:          1,
    transport_status:      'not_required',
    transport_fare:        null,
    transport_payment_ref: null,
    booking_date:          '2026-09-01',
    address:               '10 Admiralty Way',
    total_amount_kobo:     950_000,
    services:              { name: 'Standard Clean' },
    customers:             { first_name: 'Amara' },
    ...overrides,
  };
}

function makeCleanerRow(id: string, firstName: string, photoUrl: string | null = null) {
  return { id, first_name: firstName, last_name: 'Ola', photo_url: photoUrl, rating: 4.8, total_jobs: 12 };
}

describe('getBookingStatus — cleaners array shape', () => {
  it('2-keeper + dispatch cleared → cleaners.length === 2 with profiles in lead-first order', async () => {
    const LEAD_ID   = 'cl-lead';
    const SECOND_ID = 'cl-second';

    mockFrom()
      .mockReturnValueOnce(chain({ data: makeBookingRow({ keeper_count: 2 }), error: null }) as any)
      .mockReturnValueOnce(chain({
        data: [
          { cleaner_id: LEAD_ID,   role: 'lead'   },
          { cleaner_id: SECOND_ID, role: 'second' },
        ],
        error: null,
      }) as any)
      .mockReturnValueOnce(chain({
        data: [
          makeCleanerRow(LEAD_ID,   'Alice'),
          makeCleanerRow(SECOND_ID, 'Bob'),
        ],
        error: null,
      }) as any);

    const result = await getBookingStatus('bk-shape');

    expect(result).not.toBeNull();
    expect(result!.keeper_count).toBe(2);
    expect(result!.cleaners).toHaveLength(2);
    expect(result!.cleaners[0].first_name).toBe('Alice'); // lead first
    expect(result!.cleaners[1].first_name).toBe('Bob');
    expect(result!.cleaners[0].id).toBe(LEAD_ID);
    expect(result!.cleaners[1].id).toBe(SECOND_ID);
  });

  it('1-keeper + dispatch cleared → cleaners.length === 1', async () => {
    const KEEPER_ID = 'cl-solo';

    mockFrom()
      .mockReturnValueOnce(chain({ data: makeBookingRow({ keeper_count: 1 }), error: null }) as any)
      .mockReturnValueOnce(chain({
        data: [{ cleaner_id: KEEPER_ID, role: 'lead' }],
        error: null,
      }) as any)
      .mockReturnValueOnce(chain({
        data: [makeCleanerRow(KEEPER_ID, 'Tunde')],
        error: null,
      }) as any);

    const result = await getBookingStatus('bk-shape');

    expect(result!.cleaners).toHaveLength(1);
    expect(result!.cleaners[0].first_name).toBe('Tunde');
  });

  it('pre-dispatch (awaiting_payment) → cleaners.length === 0; no booking_cleaners query', async () => {
    mockFrom().mockReturnValueOnce(chain({
      data: makeBookingRow({ keeper_count: 2, transport_status: 'awaiting_payment' }),
      error: null,
    }) as any);

    const result = await getBookingStatus('bk-shape');

    expect(result!.cleaners).toHaveLength(0);
    expect(mockFrom()).toHaveBeenCalledTimes(1); // only the booking row query
  });

  it('null photo_url on both keepers → photo_url: null (not undefined) in every profile', async () => {
    const L = 'cl-no-photo-L';
    const S = 'cl-no-photo-S';

    mockFrom()
      .mockReturnValueOnce(chain({ data: makeBookingRow({ keeper_count: 2 }), error: null }) as any)
      .mockReturnValueOnce(chain({
        data: [{ cleaner_id: L, role: 'lead' }, { cleaner_id: S, role: 'second' }],
        error: null,
      }) as any)
      .mockReturnValueOnce(chain({
        data: [makeCleanerRow(L, 'Funmi', null), makeCleanerRow(S, 'Seun', null)],
        error: null,
      }) as any);

    const result = await getBookingStatus('bk-shape');

    expect(result!.cleaners[0].photo_url).toBeNull();
    expect(result!.cleaners[1].photo_url).toBeNull();
  });

  it('cleaners query may return rows in any order; result always follows booking_cleaners role order', async () => {
    // booking_cleaners returns lead (L) first, second (S) second.
    // cleaners IN query returns them in reverse order — getBookingStatus must re-sort via cleanerMap.
    const L = 'cl-lead-first';
    const S = 'cl-second-first';

    mockFrom()
      .mockReturnValueOnce(chain({ data: makeBookingRow({ keeper_count: 2 }), error: null }) as any)
      .mockReturnValueOnce(chain({
        data: [
          { cleaner_id: L, role: 'lead'   }, // role ASC → lead precedes second
          { cleaner_id: S, role: 'second' },
        ],
        error: null,
      }) as any)
      .mockReturnValueOnce(chain({
        // Returned in reverse (S before L) — common when DB index walks backwards
        data: [
          { id: S, first_name: 'Zara', last_name: '', photo_url: null, rating: 4.7, total_jobs: 5 },
          { id: L, first_name: 'Abel', last_name: '', photo_url: null, rating: 4.9, total_jobs: 20 },
        ],
        error: null,
      }) as any);

    const result = await getBookingStatus('bk-shape');

    expect(result!.cleaners[0].id).toBe(L);          // lead must be first
    expect(result!.cleaners[1].id).toBe(S);
    expect(result!.cleaners[0].first_name).toBe('Abel');
    expect(result!.cleaners[1].first_name).toBe('Zara');
  });

  it('booking not found → returns null; no cleaner queries issued', async () => {
    mockFrom().mockReturnValueOnce(chain({ data: null, error: null }) as any);

    const result = await getBookingStatus('bk-ghost');

    expect(result).toBeNull();
    expect(mockFrom()).toHaveBeenCalledTimes(1);
  });
});
