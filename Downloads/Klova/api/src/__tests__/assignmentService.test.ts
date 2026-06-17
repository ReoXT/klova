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

// Mock refundService so we can assert it's called without side effects
vi.mock('../services/refundService', () => ({
  issueRefund: vi.fn().mockResolvedValue(undefined),
}));

import { supabase } from '../lib/supabase';
import { matchCleaner, NO_MATCH } from '../services/matchingService';
import { issueRefund } from '../services/refundService';
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
  it('sets booking status to no_match and returns no_match', async () => {
    mockMatchCleaner().mockResolvedValueOnce(NO_MATCH);
    mockFrom().mockReturnValueOnce(chain({ data: null, error: null }) as any);

    const result = await assignCleaner(BOOKING_ID, bookingCtx);

    expect(result).toBe('no_match');
    // Should update the booking directly, not call the RPC
    expect(mockRpc()).not.toHaveBeenCalled();
    expect(mockFrom()).toHaveBeenCalledWith('bookings');
  });
});

// ─── Postgres RPC paths ───────────────────────────────────────────────────────

describe('assignCleaner — RPC outcomes', () => {
  it('returns matched when the Postgres function claims a slot', async () => {
    mockMatchCleaner().mockResolvedValueOnce(['c1', 'c2']);
    mockRpc().mockResolvedValueOnce({ data: 'matched:c1', error: null } as any);

    const result = await assignCleaner(BOOKING_ID, bookingCtx);

    expect(result).toBe('matched');
    expect(mockRpc()).toHaveBeenCalledWith('assign_cleaner', {
      p_booking_id: BOOKING_ID,
      p_candidate_ids: ['c1', 'c2'],
      p_booking_date: DATE,
    });
  });

  it('returns no_match when the Postgres function exhausts all candidates', async () => {
    mockMatchCleaner().mockResolvedValueOnce(['c1', 'c2']);
    mockRpc().mockResolvedValueOnce({ data: 'no_match', error: null } as any);

    const result = await assignCleaner(BOOKING_ID, bookingCtx);

    expect(result).toBe('no_match');
  });
});

// ─── Concurrency test ─────────────────────────────────────────────────────────

describe('assignCleaner — concurrency', () => {
  it('exactly one booking wins and the other is handled cleanly when two race for the same cleaner + date', async () => {
    // Both bookings go through matchCleaner and get the same ranked list.
    // The Postgres assign_cleaner function (mocked here) simulates the lock:
    // first caller wins, second caller's candidate was already taken → no_match.
    mockMatchCleaner()
      .mockResolvedValueOnce(['c1', 'c2']) // booking-A's candidate list
      .mockResolvedValueOnce(['c1', 'c2']); // booking-B's candidate list (same pool)

    mockRpc()
      .mockResolvedValueOnce({ data: 'matched:c1', error: null } as any) // booking-A wins the lock
      .mockResolvedValueOnce({ data: 'no_match', error: null } as any);  // booking-B finds all slots taken

    // Fire both at the same time — Promise.all starts both before either resolves
    const [resultA, resultB] = await Promise.all([
      assignCleaner('booking-A', bookingCtx),
      assignCleaner('booking-B', { ...bookingCtx, booking_date: DATE }),
    ]);

    // Exactly one matched, exactly one no_match — no double-booking
    const outcomes = [resultA, resultB].sort();
    expect(outcomes).toEqual(['matched', 'no_match']);

    // The RPC must have been called twice — once per booking
    expect(mockRpc()).toHaveBeenCalledTimes(2);
  });
});

// ─── Refund on no_match ───────────────────────────────────────────────────────

describe('assignCleaner — refund on no_match', () => {
  it('calls issueRefund when NO_MATCH from matchCleaner and a reference is supplied', async () => {
    mockMatchCleaner().mockResolvedValueOnce(NO_MATCH);
    mockFrom().mockReturnValueOnce(chain({ data: null, error: null }) as any);

    await assignCleaner(BOOKING_ID, bookingCtx, 'txn_abc123');

    expect(vi.mocked(issueRefund)).toHaveBeenCalledWith(BOOKING_ID, 'txn_abc123');
  });

  it('calls issueRefund when the Postgres RPC returns no_match and a reference is supplied', async () => {
    mockMatchCleaner().mockResolvedValueOnce(['c1']);
    mockRpc().mockResolvedValueOnce({ data: 'no_match', error: null } as any);

    await assignCleaner(BOOKING_ID, bookingCtx, 'txn_xyz789');

    expect(vi.mocked(issueRefund)).toHaveBeenCalledWith(BOOKING_ID, 'txn_xyz789');
  });

  it('calls issueRefund exactly once when a paid booking results in no_match via the RPC', async () => {
    mockMatchCleaner().mockResolvedValueOnce(['c1', 'c2']);
    mockRpc().mockResolvedValueOnce({ data: 'no_match', error: null } as any);

    const result = await assignCleaner(BOOKING_ID, bookingCtx, 'txn_paid_nomatch');

    expect(result).toBe('no_match');
    expect(vi.mocked(issueRefund)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(issueRefund)).toHaveBeenCalledWith(BOOKING_ID, 'txn_paid_nomatch');
  });

  it('does not call issueRefund when no paystackReference is provided', async () => {
    mockMatchCleaner().mockResolvedValueOnce(['c1']);
    mockRpc().mockResolvedValueOnce({ data: 'no_match', error: null } as any);

    await assignCleaner(BOOKING_ID, bookingCtx); // no reference

    expect(vi.mocked(issueRefund)).not.toHaveBeenCalled();
  });
});
