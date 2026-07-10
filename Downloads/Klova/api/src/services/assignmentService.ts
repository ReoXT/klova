import { supabase } from '../lib/supabase';
import { matchCleaner, NO_MATCH, type BookingForMatch } from './matchingService';
import { estimateTransportFare } from './fareEstimatorService';

export type AssignResult =
  | { outcome: 'matched'; cleanerIds: string[]; transport_estimate_kobo: number }
  | { outcome: 'no_match' };

/**
 * Selects the best available cleaner for a booking and atomically assigns them.
 *
 * Called at booking creation — the cleaner is shown to the customer before
 * they pay. Payment confirmation (webhook) then flips the booking to 'confirmed'.
 *
 * Step 1 — matchCleaner(): produces a ranked candidate list (read-only).
 * Step 2 — assign_cleaner RPC: Postgres function that iterates the list with
 *   SELECT FOR UPDATE, claiming the first slot still free. Handles concurrent
 *   bookings racing for the same cleaner + date.
 * Step 3 — storeTransportFares(): estimates and persists transport costs per
 *   keeper and as a booking-level total. Always uses a fallback on ORS failure;
 *   never blocks the matching result.
 */
export async function assignCleaner(
  bookingId: string,
  booking: BookingForMatch,
): Promise<AssignResult> {
  const candidates = await matchCleaner(booking);
  const keeperCount = booking.keeper_count ?? 1;

  if (candidates === NO_MATCH) {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'no_match', updated_at: new Date().toISOString() })
      .eq('id', bookingId);
    if (error) throw error;
    return { outcome: 'no_match' };
  }

  const { data, error } = await supabase.rpc('assign_cleaner', {
    p_booking_id: bookingId,
    p_candidate_ids: candidates,
    p_booking_date: booking.booking_date,
    p_keeper_count: keeperCount,
  });

  if (error) throw error;

  const raw = data as string;
  if (raw.startsWith('matched:')) {
    const cleanerIds = raw.slice('matched:'.length).split(',').filter(Boolean);
    // Guard the all-or-nothing RPC contract at the application layer.
    // The Postgres fn guarantees this, but we defend against protocol drift.
    if (cleanerIds.length !== keeperCount) {
      console.error(
        `[assignment] ${bookingId}: RPC returned ${cleanerIds.length}/${keeperCount} IDs — ` +
        `treating as no_match (RPC contract violation)`,
      );
      return { outcome: 'no_match' };
    }

    const transportKobo = await storeTransportFares(bookingId, cleanerIds, booking);

    return { outcome: 'matched', cleanerIds, transport_estimate_kobo: transportKobo };
  }

  // RPC exhausted the candidate list before filling all required slots.
  // For 2-keeper bookings this most likely means a race (another booking
  // claimed the second slot between matchCleaner() and the RPC).
  if (keeperCount > 1) {
    console.error(
      `[assignment] ${bookingId}: assign_cleaner returned no_match for ${keeperCount}-keeper ` +
      `booking (${candidates.length} candidate(s) passed) — likely a concurrent race`,
    );
  }

  return { outcome: 'no_match' };
}

/**
 * Estimates and persists transport fares for each assigned keeper.
 *
 * For each keeper: fetches their home coordinates, calls estimateTransportFare
 * (which uses ORS with a ₦1,000 fallback on failure), then writes the result to
 * booking_cleaners.transport_fare_kobo. Sums all fares into
 * bookings.transport_estimate_kobo for the customer-facing total.
 *
 * Wrapped in try/catch — transport errors are logged and never propagate to the
 * matching flow.
 */
async function storeTransportFares(
  bookingId: string,
  cleanerIds: string[],
  booking: BookingForMatch,
): Promise<number> {
  try {
    const { data: keeperRows, error: kErr } = await supabase
      .from('cleaners')
      .select('id, latitude, longitude')
      .in('id', cleanerIds);

    if (kErr) {
      console.error(`[assignment] ${bookingId}: could not fetch keeper coords — ${kErr.message}`);
    }

    const keeperMap = new Map(
      (keeperRows ?? []).map((k: { id: string; latitude: number | null; longitude: number | null }) => [
        k.id,
        k.latitude != null && k.longitude != null
          ? { lat: k.latitude, lng: k.longitude }
          : null,
      ]),
    );

    const customerCoords =
      typeof booking.latitude === 'number' && typeof booking.longitude === 'number'
        ? { lat: booking.latitude, lng: booking.longitude }
        : null;

    let totalKobo = 0;

    for (const cleanerId of cleanerIds) {
      const keeperCoords = keeperMap.get(cleanerId) ?? null;

      const { fare_kobo } = await estimateTransportFare(
        keeperCoords,
        customerCoords,
        { bookingId, keeperId: cleanerId },
      );

      totalKobo += fare_kobo;

      const { error: bcErr } = await supabase
        .from('booking_cleaners')
        .update({ transport_fare_kobo: fare_kobo })
        .eq('booking_id', bookingId)
        .eq('cleaner_id', cleanerId);

      if (bcErr) {
        console.error(
          `[assignment] ${bookingId}: failed to store transport fare for keeper ${cleanerId} — ${bcErr.message}`,
        );
      }
    }

    const { error: bErr } = await supabase
      .from('bookings')
      .update({ transport_estimate_kobo: totalKobo })
      .eq('id', bookingId);

    if (bErr) {
      console.error(`[assignment] ${bookingId}: failed to store transport estimate — ${bErr.message}`);
    }

    return totalKobo;
  } catch (err) {
    console.error(`[assignment] ${bookingId}: unexpected error in transport estimation — ${err}`);
    return 0;
  }
}
