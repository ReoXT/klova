import { supabase } from '../lib/supabase';
import { matchCleaner, NO_MATCH, type BookingForMatch } from './matchingService';

export type AssignResult =
  | { outcome: 'matched'; cleanerIds: string[] }
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
    const cleanerIds = raw.slice('matched:'.length).split(',');
    return { outcome: 'matched', cleanerIds };
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
