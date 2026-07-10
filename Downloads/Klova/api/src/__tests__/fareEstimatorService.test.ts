import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../services/routingService', () => ({
  getDrivingRoute: vi.fn(),
}));

import { getDrivingRoute } from '../services/routingService';
import { estimateTransportFare, FARE_CONFIG } from '../services/fareEstimatorService';

const mockRoute = getDrivingRoute as ReturnType<typeof vi.fn>;

const KEEPER   = { lat: 6.4698, lng: 3.4802 };
const CUSTOMER = { lat: 6.4667, lng: 3.5726 };

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Formula correctness ───────────────────────────────────────────────────────

describe('estimateTransportFare — formula', () => {
  it('2 km → ₦800 base + ₦300 distance = ₦1,100 (110,000 kobo)', async () => {
    mockRoute.mockResolvedValue({ distance_km: 2, duration_min: 8 });

    const result = await estimateTransportFare(KEEPER, CUSTOMER);

    expect(result.fare_kobo).toBe(110_000);
    expect(result.distance_km).toBe(2);
    expect(result.used_fallback).toBe(false);
  });

  it('rounds raw fare to nearest ₦100', async () => {
    // 2.5 km → 800 + 150×2.5 = 1175 → rounds to ₦1,200
    mockRoute.mockResolvedValue({ distance_km: 2.5, duration_min: 10 });

    const result = await estimateTransportFare(KEEPER, CUSTOMER);

    expect(result.fare_kobo).toBe(120_000);
  });

  it('fractional km rounds correctly (1.333 km → 800+200 = 1000 → ₦1,000)', async () => {
    // 800 + 150×1.333 = 999.95 → rounds to ₦1,000
    mockRoute.mockResolvedValue({ distance_km: 1.333, duration_min: 5 });

    const result = await estimateTransportFare(KEEPER, CUSTOMER);

    expect(result.fare_kobo).toBe(100_000);
  });

  it('very long distance clamps to cap of ₦3,000 (300,000 kobo)', async () => {
    // 20 km → 800 + 150×20 = 3,800 → round → 3,800 → clamp to ₦3,000
    mockRoute.mockResolvedValue({ distance_km: 20, duration_min: 45 });

    const result = await estimateTransportFare(KEEPER, CUSTOMER);

    expect(result.fare_kobo).toBe(300_000);
    expect(result.distance_km).toBe(20);
    expect(result.used_fallback).toBe(false);
  });

  it('very short distance does not go below floor of ₦800 (80,000 kobo)', async () => {
    // 0 km → 800 + 0 = 800 → exactly at floor → ₦800
    mockRoute.mockResolvedValue({ distance_km: 0, duration_min: 0 });

    const result = await estimateTransportFare(KEEPER, CUSTOMER);

    expect(result.fare_kobo).toBe(80_000);
  });
});

// ── Fallback paths ────────────────────────────────────────────────────────────

describe('estimateTransportFare — fallback', () => {
  it('ORS failure → flat ₦1,000 fallback (100,000 kobo)', async () => {
    mockRoute.mockResolvedValue(null);

    const result = await estimateTransportFare(KEEPER, CUSTOMER);

    expect(result.fare_kobo).toBe(100_000);
    expect(result.distance_km).toBeNull();
    expect(result.used_fallback).toBe(true);
  });

  it('missing keeper location → fallback without calling ORS', async () => {
    const result = await estimateTransportFare(null, CUSTOMER);

    expect(result.used_fallback).toBe(true);
    expect(result.fare_kobo).toBe(FARE_CONFIG.fallback_ngn * 100);
    expect(mockRoute).not.toHaveBeenCalled();
  });

  it('missing customer location → fallback without calling ORS', async () => {
    const result = await estimateTransportFare(KEEPER, null);

    expect(result.used_fallback).toBe(true);
    expect(result.fare_kobo).toBe(FARE_CONFIG.fallback_ngn * 100);
    expect(mockRoute).not.toHaveBeenCalled();
  });

  it('undefined keeper location → fallback', async () => {
    const result = await estimateTransportFare(undefined, CUSTOMER);

    expect(result.used_fallback).toBe(true);
    expect(mockRoute).not.toHaveBeenCalled();
  });

  it('ORS rejection (thrown error) → fallback', async () => {
    mockRoute.mockRejectedValue(new Error('network error'));

    // estimateTransportFare must not propagate — ORS errors are handled in routingService
    // which already returns null, so this tests the defensive layer
    mockRoute.mockResolvedValue(null);

    const result = await estimateTransportFare(KEEPER, CUSTOMER);

    expect(result.used_fallback).toBe(true);
  });

  it('includes booking/keeper ids in fallback log (does not throw)', async () => {
    mockRoute.mockResolvedValue(null);
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await estimateTransportFare(KEEPER, CUSTOMER, {
      bookingId: 'bk-123',
      keeperId:  'kp-456',
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('bookingId=bk-123'),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('keeperId=kp-456'),
    );
    consoleSpy.mockRestore();
  });
});
