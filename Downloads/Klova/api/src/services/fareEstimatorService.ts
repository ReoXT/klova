/**
 * Automatic transport-fare estimator.
 *
 * Calls the ORS routing client for the driving distance between a keeper's
 * home and the customer's address, then applies a simple linear formula:
 *
 *   fare = base + per_km × distance_km
 *   → rounded to the nearest ₦100
 *   → clamped to [floor, cap]
 *
 * All monetary constants live in FARE_CONFIG so they can be retuned without
 * touching call sites. Amounts are in NGN internally; output is in kobo.
 *
 * Any ORS failure or missing coordinates triggers a flat fallback fare and
 * logs the reason + context ids so the frequency can be monitored.
 */

import { getDrivingRoute } from './routingService';

// ── Config ────────────────────────────────────────────────────────────────────
// All values in NGN. Edit only here to retune pricing.

export const FARE_CONFIG = {
  base_ngn:     800,   // fixed charge regardless of distance
  per_km_ngn:   150,   // incremental rate per kilometre
  floor_ngn:    800,   // minimum fare (no fare below this)
  cap_ngn:    3_000,   // maximum fare (no fare above this)
  fallback_ngn: 1_000, // flat fare returned when routing fails
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TransportFareEstimate {
  fare_kobo:     number;        // fare in kobo (100 kobo = ₦1)
  distance_km:   number | null; // null when ORS was not reached
  used_fallback: boolean;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function toFallback(
  reason: string,
  ctx?: { bookingId?: string; keeperId?: string },
): TransportFareEstimate {
  const tag = [
    ctx?.bookingId ? `bookingId=${ctx.bookingId}` : '',
    ctx?.keeperId  ? `keeperId=${ctx.keeperId}`   : '',
  ].filter(Boolean).join(' ');

  console.warn(`[fare-estimator] fallback fired — ${reason}${tag ? ` | ${tag}` : ''}`);

  return {
    fare_kobo:     FARE_CONFIG.fallback_ngn * 100,
    distance_km:   null,
    used_fallback: true,
  };
}

function computeFareKobo(distance_km: number): number {
  const raw     = FARE_CONFIG.base_ngn + FARE_CONFIG.per_km_ngn * distance_km;
  const rounded = Math.round(raw / 100) * 100;               // nearest ₦100
  const clamped = Math.max(FARE_CONFIG.floor_ngn, Math.min(FARE_CONFIG.cap_ngn, rounded));
  return clamped * 100;                                        // NGN → kobo
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Estimates the transport fare for a keeper travelling to a customer.
 *
 * @param keeperLocation   - Keeper's home coordinates (may be null if unset).
 * @param customerLocation - Customer's pin coordinates (may be null if unset).
 * @param ctx              - Optional ids used in fallback log messages.
 */
export async function estimateTransportFare(
  keeperLocation:   LatLng | null | undefined,
  customerLocation: LatLng | null | undefined,
  ctx?: { bookingId?: string; keeperId?: string },
): Promise<TransportFareEstimate> {
  if (!keeperLocation)   return toFallback('keeper location missing', ctx);
  if (!customerLocation) return toFallback('customer location missing', ctx);

  const route = await getDrivingRoute(keeperLocation, customerLocation);

  if (!route) return toFallback('ORS routing failed', ctx);

  return {
    fare_kobo:     computeFareKobo(route.distance_km),
    distance_km:   route.distance_km,
    used_fallback: false,
  };
}
