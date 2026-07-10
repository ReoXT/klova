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

// Mock fareEstimatorService — transport estimation is tested separately
vi.mock('../services/fareEstimatorService', () => ({
  estimateTransportFare: vi.fn(),
}));

import { supabase } from '../lib/supabase';
import { matchCleaner, NO_MATCH } from '../services/matchingService';
import { estimateTransportFare } from '../services/fareEstimatorService';
import { assignCleaner } from '../services/assignmentService';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function chain(result: { data: unknown; error: unknown }) {
  const b: any = {};
  b.then = (resolve: (v: any) => any, reject?: (v: any) => any) =>
    Promise.resolve(result).then(resolve, reject);
  b.catch = (reject: (v: any) => any) => Promise.resolve(result).catch(reject);
  for (const m of ['select', 'eq', 'update', 'in', 'not']) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  return b;
}

const ok    = () => chain({ data: null, error: null });
const mockMatchCleaner = () => vi.mocked(matchCleaner);
const mockEstimateFare = () => vi.mocked(estimateTransportFare);
const mockRpc  = () => vi.mocked(supabase.rpc);
const mockFrom = () => vi.mocked(supabase.from);

// Default keeper-coord rows for cleaners fetch
function keeperRows(ids: string[]) {
  return chain({
    data: ids.map((id, i) => ({
      id,
      latitude:  6.47 + i * 0.01,
      longitude: 3.48 + i * 0.01,
    })),
    error: null,
  });
}

// Queue up from() mocks for the transport storage phase of a matched booking.
// Call once per matched keeper set so tests don't need to repeat boilerplate.
function queueTransportMocks(keeperCount: number) {
  mockFrom()
    .mockReturnValueOnce(keeperRows(Array.from({ length: keeperCount }, (_, i) => `c${i + 1}`)) as any); // cleaners SELECT
  for (let i = 0; i < keeperCount; i++) {
    mockFrom().mockReturnValueOnce(ok() as any); // booking_cleaners UPDATE per keeper
  }
  mockFrom().mockReturnValueOnce(ok() as any); // bookings UPDATE transport_estimate_kobo
}

beforeEach(() => {
  vi.clearAllMocks();

  // Default: estimateTransportFare returns ₦1,000 fallback so tests don't need ORS
  mockEstimateFare().mockResolvedValue({
    fare_kobo: 100_000,
    distance_km: null,
    used_fallback: true,
  });
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

// With customer coordinates (for transport tests)
const bookingCtxWithCoords = {
  ...bookingCtx,
  latitude:  6.43,
  longitude: 3.47,
};

// ─── NO_MATCH from matchCleaner ───────────────────────────────────────────────

describe('assignCleaner — when matchCleaner finds no candidates', () => {
  it('sets booking status to no_match and returns { outcome: no_match }', async () => {
    mockMatchCleaner().mockResolvedValueOnce(NO_MATCH);
    mockFrom().mockReturnValueOnce(ok() as any);

    const result = await assignCleaner(BOOKING_ID, bookingCtx);

    expect(result).toEqual({ outcome: 'no_match' });
    expect(mockRpc()).not.toHaveBeenCalled();
    expect(mockFrom()).toHaveBeenCalledWith('bookings');
  });
});

// ─── Postgres RPC paths ───────────────────────────────────────────────────────

describe('assignCleaner — RPC outcomes', () => {
  it('returns { outcome: matched, cleanerIds: [c1] } when one keeper is assigned', async () => {
    mockMatchCleaner().mockResolvedValueOnce(['c1', 'c2']);
    mockRpc().mockResolvedValueOnce({ data: 'matched:c1', error: null } as any);
    queueTransportMocks(1);

    const result = await assignCleaner(BOOKING_ID, bookingCtx);

    expect(result).toMatchObject({ outcome: 'matched', cleanerIds: ['c1'] });
    expect(mockRpc()).toHaveBeenCalledWith('assign_cleaner', {
      p_booking_id:    BOOKING_ID,
      p_candidate_ids: ['c1', 'c2'],
      p_booking_date:  DATE,
      p_keeper_count:  1,
    });
  });

  it('returns { outcome: matched, cleanerIds: [c1, c2] } when two keepers are assigned', async () => {
    mockMatchCleaner().mockResolvedValueOnce(['c1', 'c2', 'c3']);
    mockRpc().mockResolvedValueOnce({ data: 'matched:c1,c2', error: null } as any);
    queueTransportMocks(2);

    const result = await assignCleaner(BOOKING_ID, { ...bookingCtx, keeper_count: 2 });

    expect(result).toMatchObject({ outcome: 'matched', cleanerIds: ['c1', 'c2'] });
    expect(mockRpc()).toHaveBeenCalledWith('assign_cleaner', {
      p_booking_id:    BOOKING_ID,
      p_candidate_ids: ['c1', 'c2', 'c3'],
      p_booking_date:  DATE,
      p_keeper_count:  2,
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

    // The matched booking (booking-A) will make 3 from() calls for transport
    queueTransportMocks(1);

    const [resultA, resultB] = await Promise.all([
      assignCleaner('booking-A', bookingCtx),
      assignCleaner('booking-B', { ...bookingCtx, booking_date: DATE }),
    ]);

    const outcomes = [resultA.outcome, resultB.outcome].sort();
    expect(outcomes).toEqual(['matched', 'no_match']);
    expect(mockRpc()).toHaveBeenCalledTimes(2);
  });
});

// ─── Transport fare storage ───────────────────────────────────────────────────

describe('assignCleaner — transport fare storage (single keeper)', () => {
  it('calls estimateTransportFare with keeper and customer coords', async () => {
    mockMatchCleaner().mockResolvedValueOnce(['c1']);
    mockRpc().mockResolvedValueOnce({ data: 'matched:c1', error: null } as any);

    mockFrom().mockReturnValueOnce(chain({
      data: [{ id: 'c1', latitude: 6.47, longitude: 3.48 }],
      error: null,
    }) as any);
    mockFrom().mockReturnValueOnce(ok() as any); // booking_cleaners UPDATE
    mockFrom().mockReturnValueOnce(ok() as any); // bookings UPDATE

    mockEstimateFare().mockResolvedValueOnce({ fare_kobo: 110_000, distance_km: 2, used_fallback: false });

    await assignCleaner(BOOKING_ID, bookingCtxWithCoords);

    expect(mockEstimateFare()).toHaveBeenCalledWith(
      { lat: 6.47, lng: 3.48 },
      { lat: 6.43, lng: 3.47 },
      { bookingId: BOOKING_ID, keeperId: 'c1' },
    );
  });

  it('writes fare_kobo to booking_cleaners and transport_estimate_kobo to bookings', async () => {
    mockMatchCleaner().mockResolvedValueOnce(['c1']);
    mockRpc().mockResolvedValueOnce({ data: 'matched:c1', error: null } as any);

    const cleanersChain = chain({ data: [{ id: 'c1', latitude: 6.47, longitude: 3.48 }], error: null });
    const bcChain       = chain({ data: null, error: null });
    const bookingsChain = chain({ data: null, error: null });

    mockFrom()
      .mockReturnValueOnce(cleanersChain as any)
      .mockReturnValueOnce(bcChain as any)
      .mockReturnValueOnce(bookingsChain as any);

    mockEstimateFare().mockResolvedValueOnce({ fare_kobo: 110_000, distance_km: 2, used_fallback: false });

    await assignCleaner(BOOKING_ID, bookingCtxWithCoords);

    // booking_cleaners update
    expect(bcChain.update).toHaveBeenCalledWith({ transport_fare_kobo: 110_000 });
    expect(bcChain.eq).toHaveBeenCalledWith('booking_id', BOOKING_ID);
    expect(bcChain.eq).toHaveBeenCalledWith('cleaner_id', 'c1');

    // bookings transport_estimate_kobo
    expect(bookingsChain.update).toHaveBeenCalledWith({ transport_estimate_kobo: 110_000 });
    expect(bookingsChain.eq).toHaveBeenCalledWith('id', BOOKING_ID);
  });

  it('still returns matched when estimateTransportFare uses fallback', async () => {
    mockMatchCleaner().mockResolvedValueOnce(['c1']);
    mockRpc().mockResolvedValueOnce({ data: 'matched:c1', error: null } as any);

    mockFrom()
      .mockReturnValueOnce(chain({ data: [{ id: 'c1', latitude: null, longitude: null }], error: null }) as any)
      .mockReturnValueOnce(ok() as any)
      .mockReturnValueOnce(ok() as any);

    mockEstimateFare().mockResolvedValueOnce({ fare_kobo: 100_000, distance_km: null, used_fallback: true });

    const result = await assignCleaner(BOOKING_ID, { ...bookingCtx, latitude: null, longitude: null });

    expect(result).toMatchObject({ outcome: 'matched', cleanerIds: ['c1'] });
  });
});

describe('assignCleaner — transport fare storage (two keepers)', () => {
  it('stores separate fares for each keeper and sums them in bookings', async () => {
    mockMatchCleaner().mockResolvedValueOnce(['c1', 'c2', 'c3']);
    mockRpc().mockResolvedValueOnce({ data: 'matched:c1,c2', error: null } as any);

    const cleanersChain  = chain({
      data: [
        { id: 'c1', latitude: 6.47, longitude: 3.48 },
        { id: 'c2', latitude: 6.50, longitude: 3.50 },
      ],
      error: null,
    });
    const bc1Chain       = chain({ data: null, error: null });
    const bc2Chain       = chain({ data: null, error: null });
    const bookingsChain  = chain({ data: null, error: null });

    mockFrom()
      .mockReturnValueOnce(cleanersChain as any)
      .mockReturnValueOnce(bc1Chain as any)
      .mockReturnValueOnce(bc2Chain as any)
      .mockReturnValueOnce(bookingsChain as any);

    // c1 → 2 km, c2 → 5 km
    mockEstimateFare()
      .mockResolvedValueOnce({ fare_kobo: 110_000, distance_km: 2, used_fallback: false })
      .mockResolvedValueOnce({ fare_kobo: 155_000, distance_km: 5, used_fallback: false });

    const result = await assignCleaner(BOOKING_ID, { ...bookingCtxWithCoords, keeper_count: 2 });

    expect(result).toMatchObject({ outcome: 'matched', cleanerIds: ['c1', 'c2'], transport_estimate_kobo: 265_000 });

    // Per-keeper storage
    expect(bc1Chain.update).toHaveBeenCalledWith({ transport_fare_kobo: 110_000 });
    expect(bc1Chain.eq).toHaveBeenCalledWith('cleaner_id', 'c1');

    expect(bc2Chain.update).toHaveBeenCalledWith({ transport_fare_kobo: 155_000 });
    expect(bc2Chain.eq).toHaveBeenCalledWith('cleaner_id', 'c2');

    // Booking-level total = 110,000 + 155,000
    expect(bookingsChain.update).toHaveBeenCalledWith({ transport_estimate_kobo: 265_000 });
  });

  it('each keeper gets estimated from their own coordinates', async () => {
    mockMatchCleaner().mockResolvedValueOnce(['c1', 'c2']);
    mockRpc().mockResolvedValueOnce({ data: 'matched:c1,c2', error: null } as any);

    mockFrom()
      .mockReturnValueOnce(chain({
        data: [
          { id: 'c1', latitude: 6.47, longitude: 3.48 },
          { id: 'c2', latitude: 6.55, longitude: 3.55 },
        ],
        error: null,
      }) as any)
      .mockReturnValueOnce(ok() as any)
      .mockReturnValueOnce(ok() as any)
      .mockReturnValueOnce(ok() as any);

    await assignCleaner(BOOKING_ID, { ...bookingCtxWithCoords, keeper_count: 2 });

    const calls = mockEstimateFare().mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toEqual({ lat: 6.47, lng: 3.48 }); // c1 coords
    expect(calls[1][0]).toEqual({ lat: 6.55, lng: 3.55 }); // c2 coords
    // Both use the same customer coords
    expect(calls[0][1]).toEqual({ lat: 6.43, lng: 3.47 });
    expect(calls[1][1]).toEqual({ lat: 6.43, lng: 3.47 });
  });
});
