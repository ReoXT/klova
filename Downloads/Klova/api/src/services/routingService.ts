/**
 * Thin ORS (OpenRouteService) driving-distance client.
 *
 * API shape (confirmed against ORS v2 docs):
 *   POST https://api.openrouteservice.org/v2/directions/driving-car
 *   Authorization: Bearer <JWT>          (keys from account.heigit.org)
 *   Content-Type: application/json
 *   Body: { "coordinates": [[lng, lat], [lng, lat]] }   ← ORS uses lng-first
 *
 * Success response (application/json):
 *   { "routes": [{ "summary": { "distance": <metres>, "duration": <seconds> } }] }
 *
 * Error codes:
 *   403 — daily quota exhausted
 *   429 — per-minute rate limit
 *   2010 (body) — route not found / unroutable
 */

export interface RouteSummary {
  distance_km: number;
  duration_min: number;
}

const ORS_URL    = 'https://api.openrouteservice.org/v2/directions/driving-car';
const TIMEOUT_MS = 8_000;

/**
 * Returns the driving distance and duration between two coordinates via ORS.
 *
 * Always returns null on failure (quota, timeout, unroutable, missing key) so
 * callers in the booking flow never need to handle exceptions.
 */
export async function getDrivingRoute(
  origin: { lat: number; lng: number },
  dest:   { lat: number; lng: number },
): Promise<RouteSummary | null> {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) {
    console.warn('[routing] ORS_API_KEY not configured — route lookup skipped');
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(ORS_URL, {
      method: 'POST',
      headers: {
        Authorization:   `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
        Accept:          'application/json',
      },
      body: JSON.stringify({
        coordinates: [
          [origin.lng, origin.lat],
          [dest.lng,   dest.lat],
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (res.status === 403) {
      console.error('[routing] ORS daily quota exceeded (403)');
      return null;
    }
    if (res.status === 429) {
      console.error('[routing] ORS per-minute rate limit hit (429)');
      return null;
    }
    if (!res.ok) {
      console.error(`[routing] ORS returned unexpected status ${res.status}`);
      return null;
    }

    const data = await res.json() as {
      routes?: Array<{ summary?: { distance?: number; duration?: number } }>;
    };

    const summary = data.routes?.[0]?.summary;
    if (
      summary == null ||
      typeof summary.distance !== 'number' ||
      typeof summary.duration !== 'number'
    ) {
      console.warn('[routing] ORS returned no routable path for these coordinates');
      return null;
    }

    return {
      distance_km:  Math.round((summary.distance / 1000) * 10) / 10, // 1 dp
      duration_min: Math.round(summary.duration / 60),
    };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[routing] ORS request timed out after 8 s');
    } else {
      console.error('[routing] ORS request failed:', err);
    }
    return null;
  }
}
