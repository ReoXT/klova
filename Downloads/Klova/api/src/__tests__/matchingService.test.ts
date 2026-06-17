import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from '../lib/supabase';
import { matchCleaner, NO_MATCH, type BookingForMatch } from '../services/matchingService';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/**
 * Returns a fluent Supabase query builder that is also thenable.
 * Any method that isn't a terminal call (single) returns the same object,
 * so `await supabase.from('x').select('y').eq('z', v)` resolves to `result`.
 */
function chain(result: { data: unknown; error: unknown }) {
  const b: any = {};
  // Make the object awaitable — JS calls .then() when you `await` it
  b.then = (resolve: (v: any) => any, reject?: (v: any) => any) =>
    Promise.resolve(result).then(resolve, reject);
  b.catch = (reject: (v: any) => any) => Promise.resolve(result).catch(reject);
  for (const m of ['select', 'eq', 'in', 'gte', 'order', 'not']) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  b.single = vi.fn().mockResolvedValue(result);
  return b;
}

const mockFrom = () => vi.mocked(supabase.from);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ZONE = 'zone-lekki';
const CUSTOMER = 'cust-amara';
const DATE = '2026-07-01';

function booking(overrides: Partial<BookingForMatch> = {}): BookingForMatch {
  return {
    zone_id: ZONE,
    customer_id: CUSTOMER,
    booking_date: DATE,
    requested_cleaner_id: null,
    ...overrides,
  };
}

// Helper: mock the 4 standard from() calls
// 1. cleaner_availability  2. cleaners  3. bookings (recent)  4. ratings
function mockFourCalls(
  availability: { cleaner_id: string }[],
  cleanerRows: { id: string; rating: number }[],
  recentBookingRows: { cleaner_id: string }[],
  ratingRows: { cleaner_id: string }[],
) {
  mockFrom()
    .mockReturnValueOnce(chain({ data: availability, error: null }) as any)
    .mockReturnValueOnce(chain({ data: cleanerRows, error: null }) as any)
    .mockReturnValueOnce(chain({ data: recentBookingRows, error: null }) as any)
    .mockReturnValueOnce(chain({ data: ratingRows, error: null }) as any);
}

// ─── NO_MATCH paths ───────────────────────────────────────────────────────────

describe('matchCleaner — NO_MATCH', () => {
  it('returns NO_MATCH when no availability rows exist for the date', async () => {
    mockFrom().mockReturnValueOnce(chain({ data: [], error: null }) as any);

    const result = await matchCleaner(booking());

    expect(result).toBe(NO_MATCH);
    expect(mockFrom()).toHaveBeenCalledTimes(1); // stops after availability check
  });

  it('returns NO_MATCH when available cleaners are not in the booking zone / not active', async () => {
    mockFrom()
      .mockReturnValueOnce(chain({ data: [{ cleaner_id: 'c1' }], error: null }) as any)
      .mockReturnValueOnce(chain({ data: [], error: null }) as any); // zone/status filter removes all

    const result = await matchCleaner(booking());

    expect(result).toBe(NO_MATCH);
    expect(mockFrom()).toHaveBeenCalledTimes(2);
  });
});

// ─── Priority 1: requested cleaner ───────────────────────────────────────────

describe('matchCleaner — Priority 1: requested cleaner', () => {
  it('picks the requested cleaner when they are in the candidate set', async () => {
    // c1 is requested; c2 has a higher rating but should not win
    mockFrom()
      .mockReturnValueOnce(chain({ data: [{ cleaner_id: 'c1' }, { cleaner_id: 'c2' }], error: null }) as any)
      .mockReturnValueOnce(chain({ data: [{ id: 'c1', rating: 4.5 }, { id: 'c2', rating: 4.9 }], error: null }) as any)
      .mockReturnValueOnce(chain({ data: [], error: null }) as any); // recent jobs

    // Ratings query should NOT be reached — Priority 1 fires first
    const result = await matchCleaner(booking({ requested_cleaner_id: 'c1' }));

    expect(result).toBe('c1');
    expect(mockFrom()).toHaveBeenCalledTimes(3); // no ratings query
  });

  it('falls through when the requested cleaner is not in the candidate set', async () => {
    // 'c-unavailable' is not in availability → falls to Priority 3
    mockFourCalls(
      [{ cleaner_id: 'c1' }],
      [{ id: 'c1', rating: 4.8 }],
      [],
      [], // no 5-star ratings
    );

    const result = await matchCleaner(booking({ requested_cleaner_id: 'c-unavailable' }));

    expect(result).toBe('c1'); // Priority 3: only candidate
  });
});

// ─── Priority 2: 5-star preferred cleaner ────────────────────────────────────

describe('matchCleaner — Priority 2: 5-star preferred', () => {
  it('picks a 5-star preferred cleaner over a higher-rated stranger', async () => {
    // c1 (4.5★) is a 5-star preferred; c2 (4.9★) is a stranger
    mockFourCalls(
      [{ cleaner_id: 'c1' }, { cleaner_id: 'c2' }],
      [{ id: 'c1', rating: 4.5 }, { id: 'c2', rating: 4.9 }],
      [],
      [{ cleaner_id: 'c1' }], // customer rated c1 five stars
    );

    const result = await matchCleaner(booking());

    expect(result).toBe('c1');
  });

  it('among multiple 5-star preferred cleaners, picks the highest-rated one', async () => {
    // c1 (4.5★) and c2 (4.9★) are both preferred; c2 should win
    mockFourCalls(
      [{ cleaner_id: 'c1' }, { cleaner_id: 'c2' }, { cleaner_id: 'c3' }],
      [{ id: 'c1', rating: 4.5 }, { id: 'c2', rating: 4.9 }, { id: 'c3', rating: 4.7 }],
      [],
      [{ cleaner_id: 'c1' }, { cleaner_id: 'c2' }], // both preferred
    );

    const result = await matchCleaner(booking());

    expect(result).toBe('c2'); // highest rated among preferred
  });

  it('among preferred cleaners with equal rating, picks the one with fewer recent jobs', async () => {
    // c1 and c2 both preferred, both 4.8★; c2 has 2 recent jobs vs c1 with 0
    mockFourCalls(
      [{ cleaner_id: 'c1' }, { cleaner_id: 'c2' }],
      [{ id: 'c1', rating: 4.8 }, { id: 'c2', rating: 4.8 }],
      [{ cleaner_id: 'c2' }, { cleaner_id: 'c2' }], // c2 has 2 recent jobs
      [{ cleaner_id: 'c1' }, { cleaner_id: 'c2' }],
    );

    const result = await matchCleaner(booking());

    expect(result).toBe('c1'); // same rating, fewer load
  });
});

// ─── Priority 3: general pool ─────────────────────────────────────────────────

describe('matchCleaner — Priority 3: general pool', () => {
  it('picks the highest-rated candidate when no preferred cleaners exist', async () => {
    // c2 (4.9★) should win over c1 (4.5★)
    mockFourCalls(
      [{ cleaner_id: 'c1' }, { cleaner_id: 'c2' }],
      [{ id: 'c1', rating: 4.5 }, { id: 'c2', rating: 4.9 }],
      [],
      [], // no 5-star history
    );

    const result = await matchCleaner(booking());

    expect(result).toBe('c2');
  });

  it('breaks a rating tie with fewest recent jobs', async () => {
    // c1 and c2 both 4.8★; c1 has 2 recent jobs, c2 has 0
    mockFourCalls(
      [{ cleaner_id: 'c1' }, { cleaner_id: 'c2' }],
      [{ id: 'c1', rating: 4.8 }, { id: 'c2', rating: 4.8 }],
      [{ cleaner_id: 'c1' }, { cleaner_id: 'c1' }], // c1 has 2 recent jobs
      [],
    );

    const result = await matchCleaner(booking());

    expect(result).toBe('c2'); // same rating, c2 is less loaded
  });
});
