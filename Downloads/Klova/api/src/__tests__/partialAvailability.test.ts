import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Module mocks ─────────────────────────────────────────────────────────────
//
// We isolate bookingService from every I/O boundary so we can drive the
// partial-availability branch without a real DB or cleaner pool.

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }));

vi.mock('../services/matchingService', () => ({
  NO_MATCH: 'NO_MATCH',
  matchCleaner: vi.fn(),
}));

vi.mock('../services/pricingService', () => ({
  computePrice: vi.fn(),
  // ValidationError must be a real class so instanceof checks in bookingService work.
  ValidationError: class ValidationError extends Error {
    readonly status = 400;
  },
}));

vi.mock('../services/availabilityService', () => ({
  getAlternativeDates: vi.fn(),
}));

vi.mock('../services/assignmentService', () => ({
  assignCleaner: vi.fn(),
}));

import { supabase } from '../lib/supabase';
import { matchCleaner } from '../services/matchingService';
import { computePrice } from '../services/pricingService';
import { getAlternativeDates } from '../services/availabilityService';
import { createBooking, PartialAvailabilityError } from '../services/bookingService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Thenable chain that supports both direct-await and .single() terminal calls.
function chain(result: { data: unknown; error: unknown }) {
  const b: any = {};
  b.then = (resolve: (v: any) => any, reject?: (v: any) => any) =>
    Promise.resolve(result).then(resolve, reject);
  b.catch = (fn: (v: any) => any) => Promise.resolve(result).catch(fn);
  b.single = vi.fn().mockResolvedValue(result);
  for (const m of ['select', 'eq', 'upsert', 'insert', 'update', 'in', 'order']) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  return b;
}

const mockFrom       = () => vi.mocked(supabase.from);
const mockMatch      = () => vi.mocked(matchCleaner);
const mockPrice      = () => vi.mocked(computePrice);
const mockAltDates   = () => vi.mocked(getAlternativeDates);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ZONE_ID  = 'zone-lekki-uuid';
const CUST_ID  = 'cust-amara-uuid';

/** Minimal valid input shared across tests — spread to override. */
const BASE_INPUT = {
  first_name: 'Amara',
  last_name:  'Obi',
  phone:      '08012345678',
  address:    '14 Admiralty Way, Lekki Phase 1',
  zone_slug:  'lekki-ajah',
  service_slug: 'standard',
  bedrooms:   '2',
  addon_slugs: [] as string[],
  booking_date: '2026-07-01',
};

// Minimal PriceBreakdown shape (fields bookingService reads from it)
const PRICE_2K = {
  service_id: 'svc-standard',
  addon_ids:  [],
  base_amount: 19_000,     // ₦9,500 × 2 keepers
  addons_amount: 0,
  insurance_amount: 0,
  total_amount: 19_000,
  commission_amount: 4_180,
  commission_rate: 0.22,
};

const PRICE_1K = {
  service_id: 'svc-standard',
  addon_ids:  [],
  base_amount: 9_500,      // ₦9,500 × 1 keeper
  addons_amount: 0,
  insurance_amount: 0,
  total_amount: 9_500,
  commission_amount: 2_090,
  commission_rate: 0.22,
};

// Set up the two Supabase calls that always happen before the pre-flight check:
//   1. zones lookup (single)
//   2. customers upsert (single)
function mockZoneAndCustomer() {
  mockFrom()
    .mockReturnValueOnce(
      chain({ data: { id: ZONE_ID, is_active: true }, error: null }) as any,
    )
    .mockReturnValueOnce(
      chain({ data: { id: CUST_ID }, error: null }) as any,
    );
}

// ─── Partial-availability detection ──────────────────────────────────────────

describe('createBooking — partial availability (keeper_count=2, only 1 cleaner free)', () => {
  it('throws PartialAvailabilityError without creating a booking row', async () => {
    mockZoneAndCustomer();
    mockPrice().mockResolvedValueOnce(PRICE_2K as any); // initial 2-keeper price
    mockMatch().mockResolvedValueOnce(['c1']);           // only 1 candidate
    mockPrice().mockResolvedValueOnce(PRICE_1K as any); // recomputed 1-keeper price
    mockAltDates().mockResolvedValueOnce(['2026-07-05', '2026-07-08']);

    await expect(
      createBooking({ ...BASE_INPUT, keeper_count: 2 }),
    ).rejects.toThrow(PartialAvailabilityError);

    // Booking INSERT never happened — only zones + customers were touched
    expect(mockFrom()).toHaveBeenCalledTimes(2);
  });

  it('error carries the recomputed 1-keeper price', async () => {
    mockZoneAndCustomer();
    mockPrice().mockResolvedValueOnce(PRICE_2K as any);
    mockMatch().mockResolvedValueOnce(['c1']);
    mockPrice().mockResolvedValueOnce(PRICE_1K as any);
    mockAltDates().mockResolvedValueOnce([]);

    let caught: PartialAvailabilityError | undefined;
    try {
      await createBooking({ ...BASE_INPUT, keeper_count: 2 });
    } catch (err) {
      if (err instanceof PartialAvailabilityError) caught = err;
    }

    expect(caught).toBeDefined();
    expect(caught!.single_keeper_price).toEqual({
      total_amount:      9_500,
      commission_amount: 2_090,
      commission_rate:   0.22,
    });
    expect(caught!.outcome).toBe('partial_availability');
  });

  it('error carries alternative dates filtered to ≥2 free cleaners', async () => {
    mockZoneAndCustomer();
    mockPrice().mockResolvedValueOnce(PRICE_2K as any);
    mockMatch().mockResolvedValueOnce(['c1']);
    mockPrice().mockResolvedValueOnce(PRICE_1K as any);
    mockAltDates().mockResolvedValueOnce(['2026-07-05', '2026-07-08']);

    let caught: PartialAvailabilityError | undefined;
    try {
      await createBooking({ ...BASE_INPUT, keeper_count: 2 });
    } catch (err) {
      if (err instanceof PartialAvailabilityError) caught = err;
    }

    expect(caught!.alternative_dates).toEqual(['2026-07-05', '2026-07-08']);
    // getAlternativeDates must have been called with minCleaners=2
    expect(mockAltDates()).toHaveBeenCalledWith('lekki-ajah', '2026-07-01', 14, 2);
  });

  it('does NOT trigger when matchCleaner returns NO_MATCH (zero cleaners) — falls through to no_match', async () => {
    mockZoneAndCustomer();
    mockPrice().mockResolvedValueOnce(PRICE_2K as any);
    mockMatch().mockResolvedValueOnce('NO_MATCH'); // zero available

    // bookingService now falls through to booking INSERT and assignCleaner.
    // The booking INSERT (from call 3) and assignCleaner will fail with
    // "not a function" or similar since we haven't set up those mocks.
    // That's fine — what we're verifying is that PartialAvailabilityError
    // is NOT thrown, and that getAlternativeDates was never called.
    await expect(
      createBooking({ ...BASE_INPUT, keeper_count: 2 }),
    ).rejects.not.toThrow(PartialAvailabilityError);

    expect(mockAltDates()).not.toHaveBeenCalled();
  });

  it('does NOT trigger for a 1-keeper booking', async () => {
    mockZoneAndCustomer();
    mockPrice().mockResolvedValueOnce(PRICE_1K as any);
    // matchCleaner is NOT called by the pre-flight check when keeper_count=1

    // Will fail at the booking INSERT or assignCleaner step (no extra mocks).
    await expect(
      createBooking({ ...BASE_INPUT, keeper_count: 1 }),
    ).rejects.not.toThrow(PartialAvailabilityError);

    expect(mockMatch()).not.toHaveBeenCalled(); // no pre-flight check runs
    expect(mockAltDates()).not.toHaveBeenCalled();
  });
});
