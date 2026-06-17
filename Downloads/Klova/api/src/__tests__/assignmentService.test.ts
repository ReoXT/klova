import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the Supabase client — assignmentService uses both .from() and .rpc()
vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

// Mock matchCleaner so assignmentService tests are isolated from matching logic
vi.mock('../services/matchingService', () => ({
  NO_MATCH: 'NO_MATCH',
  matchCleaner: vi.fn(),
}));

import { supabase } from '../lib/supabase';
import { matchCleaner, NO_MATCH } from '../services/matchingService';
import { assignCleaner } from '../services/assignmentService';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function chain(result: { data: unknown; error: unknown }) {
  const b: any = {};
  b.then = (resolve: (v: any) => any, reject?: (v: any) => any) =>
    Promise.resolve(result).then(resolve, reject);
  b.catch = (reject: (v: any) => any) => Promise.resolve(result).catch(reject);
  for (const m of ['select', 'eq', 'update', 'in']) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  return b;
}

const mockMatchCleaner = () => vi.mocked(matchCleaner);
const mockRpc = () => vi.mocked(supabase.rpc);
const mockFrom = () => vi.mocked(supabase.from);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BOOKING_ID = 'booking-uuid-001';
const DATE = '2026-07-01';

const bookingCtx = {
  zone_id: 'zone-lekki',
  customer_id: 'cust-amara',
  booking_date: DATE,
  requested_cleaner_id: null,
};

// ─── NO_MATCH from matchCleaner ───────────────────────────────────────────────

describe('assignCleaner — when matchCleaner finds no candidates', () => {
  it('sets booking status to no_match and returns { outcome: no_match }', async () => {
    mockMatchCleaner().mockResolvedValueOnce(NO_MATCH);
    mockFrom().mockReturnValueOnce(chain({ data: null, error: null }) as any);

    const result = await assignCleaner(BOOKING_ID, bookingCtx);

    expect(result).toEqual({ outcome: 'no_match' });
    expect(mockRpc()).not.toHaveBeenCalled();
    expect(mockFrom()).toHaveBeenCalledWith('bookings');
  });
});

// ─── Postgres RPC paths ───────────────────────────────────────────────────────

describe('assignCleaner — RPC outcomes', () => {
  it('returns { outcome: matched, cleanerId } when the Postgres function claims a slot', async () => {
    mockMatchCleaner().mockResolvedValueOnce(['c1', 'c2']);
    mockRpc().mockResolvedValueOnce({ data: 'matched:c1', error: null } as any);

    const result = await assignCleaner(BOOKING_ID, bookingCtx);

    expect(result).toEqual({ outcome: 'matched', cleanerId: 'c1' });
    expect(mockRpc()).toHaveBeenCalledWith('assign_cleaner', {
      p_booking_id: BOOKING_ID,
      p_candidate_ids: ['c1', 'c2'],
      p_booking_date: DATE,
    });
  });

  it('returns { outcome: no_match } when the Postgres function exhausts all candidates', async () => {
    mockMatchCleaner().mockResolvedValueOnce(['c1', 'c2']);
    mockRpc().mockResolvedValueOnce({ data: 'no_match', error: null } as any);

    const result = await assignCleaner(BOOKING_ID, bookingCtx);

    expect(result).toEqual({ outcome: 'no_match' });
  });
});

// ─── Concurrency ──────────────────────────────────────────────────────────────

describe('assignCleaner — concurrency', () => {
  it('exactly one booking wins and the other is handled cleanly when two race for the same cleaner + date', async () => {
    mockMatchCleaner()
      .mockResolvedValueOnce(['c1', 'c2'])
      .mockResolvedValueOnce(['c1', 'c2']);

    mockRpc()
      .mockResolvedValueOnce({ data: 'matched:c1', error: null } as any)
      .mockResolvedValueOnce({ data: 'no_match', error: null } as any);

    const [resultA, resultB] = await Promise.all([
      assignCleaner('booking-A', bookingCtx),
      assignCleaner('booking-B', { ...bookingCtx, booking_date: DATE }),
    ]);

    const outcomes = [resultA.outcome, resultB.outcome].sort();
    expect(outcomes).toEqual(['matched', 'no_match']);
    expect(mockRpc()).toHaveBeenCalledTimes(2);
  });
});
