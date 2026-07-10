import { vi, describe, it, expect, afterEach } from 'vitest';
import { getDrivingRoute } from '../services/routingService';

// ── Known Lagos coordinates used throughout ───────────────────────────────────
// Lekki toll gate → Ajah roundabout: ~10–15 km by road
const ORIGIN = { lat: 6.4698, lng: 3.4802 }; // Lekki toll gate
const DEST   = { lat: 6.4667, lng: 3.5726 }; // Ajah roundabout

// ── Helpers ───────────────────────────────────────────────────────────────────

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok:     status >= 200 && status < 300,
    status,
    json:   vi.fn().mockResolvedValue(body),
  }));
}

function orsBody(distanceM: number, durationS: number) {
  return { routes: [{ summary: { distance: distanceM, duration: durationS } }] };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// ── Unit tests ────────────────────────────────────────────────────────────────

describe('getDrivingRoute — unit', () => {
  it('converts metres to km (1 dp) and seconds to minutes (rounded)', async () => {
    vi.stubEnv('ORS_API_KEY', 'test-key');
    stubFetch(200, orsBody(12_345, 905)); // 12.345 km → 12.3, 905 s → 15 min

    const result = await getDrivingRoute(ORIGIN, DEST);

    expect(result).toEqual({ distance_km: 12.3, duration_min: 15 });
  });

  it('sends coordinates in [lng, lat] order as required by ORS', async () => {
    vi.stubEnv('ORS_API_KEY', 'test-key');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: vi.fn().mockResolvedValue(orsBody(5_000, 300)),
    });
    vi.stubGlobal('fetch', fetchMock);

    await getDrivingRoute(ORIGIN, DEST);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.coordinates[0]).toEqual([ORIGIN.lng, ORIGIN.lat]);
    expect(body.coordinates[1]).toEqual([DEST.lng,   DEST.lat]);
  });

  it('sends Authorization: Bearer header with the API key', async () => {
    vi.stubEnv('ORS_API_KEY', 'my-jwt-token');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: vi.fn().mockResolvedValue(orsBody(5_000, 300)),
    });
    vi.stubGlobal('fetch', fetchMock);

    await getDrivingRoute(ORIGIN, DEST);

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-jwt-token');
  });

  it('returns null when ORS_API_KEY is not set', async () => {
    vi.stubEnv('ORS_API_KEY', '');
    expect(await getDrivingRoute(ORIGIN, DEST)).toBeNull();
  });

  it('returns null on 403 — daily quota exhausted', async () => {
    vi.stubEnv('ORS_API_KEY', 'test-key');
    stubFetch(403, { error: { code: 403, message: 'Quota exceeded' } });
    expect(await getDrivingRoute(ORIGIN, DEST)).toBeNull();
  });

  it('returns null on 429 — per-minute rate limit', async () => {
    vi.stubEnv('ORS_API_KEY', 'test-key');
    stubFetch(429, { error: { code: 429, message: 'Rate limit exceeded' } });
    expect(await getDrivingRoute(ORIGIN, DEST)).toBeNull();
  });

  it('returns null on unexpected non-200 status', async () => {
    vi.stubEnv('ORS_API_KEY', 'test-key');
    stubFetch(500, { error: 'Internal server error' });
    expect(await getDrivingRoute(ORIGIN, DEST)).toBeNull();
  });

  it('returns null when routes array is empty (unroutable coordinates)', async () => {
    vi.stubEnv('ORS_API_KEY', 'test-key');
    stubFetch(200, { routes: [] });
    expect(await getDrivingRoute(ORIGIN, DEST)).toBeNull();
  });

  it('returns null when summary fields are missing from response', async () => {
    vi.stubEnv('ORS_API_KEY', 'test-key');
    stubFetch(200, { routes: [{ summary: {} }] });
    expect(await getDrivingRoute(ORIGIN, DEST)).toBeNull();
  });

  it('returns null on timeout (AbortError)', async () => {
    vi.stubEnv('ORS_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(
      Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
    ));
    expect(await getDrivingRoute(ORIGIN, DEST)).toBeNull();
  });

  it('returns null on generic network failure', async () => {
    vi.stubEnv('ORS_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')));
    expect(await getDrivingRoute(ORIGIN, DEST)).toBeNull();
  });
});

// ── Integration test — skipped unless ORS_API_KEY is present in env ───────────

describe('getDrivingRoute — integration', () => {
  it.skipIf(!process.env.ORS_API_KEY)(
    'Lekki toll gate → Ajah roundabout returns a plausible driving distance',
    async () => {
      const result = await getDrivingRoute(ORIGIN, DEST);

      expect(result).not.toBeNull();
      // By road this corridor is roughly 9–20 km; ORS traffic model adds time
      expect(result!.distance_km).toBeGreaterThan(5);
      expect(result!.distance_km).toBeLessThan(30);
      expect(result!.duration_min).toBeGreaterThan(5);
      expect(result!.duration_min).toBeLessThan(90);
    },
    15_000, // 15 s ceiling for a real HTTP round-trip
  );
});
