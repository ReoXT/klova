import { supabase } from '../lib/supabase';
import { matchCleaner, NO_MATCH, type BookingForMatch } from './matchingService';

export type AssignResult = 'matched' | 'no_match';

/**
 * Selects the best available cleaner for a booking and atomically assigns them.
 *
 * Step 1 — matchCleaner(): produces a ranked candidate list (read-only queries).
 * Step 2 — assign_cleaner RPC: Postgres function that iterates the list with
 *   SELECT FOR UPDATE, claiming the first slot still free. If a candidate was
 *   taken by a concurrent booking, it falls back to the next in the list.
 *
 * On return: booking.status is 'matched' (cleaner assigned) or 'no_match'.
 */
export async function assignCleaner(
  bookingId: string,
  booking: BookingForMatch,
): Promise<AssignResult> {
  const candidates = await matchCleaner(booking);

  if (candidates === NO_MATCH) {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'no_match', updated_at: new Date().toISOString() })
      .eq('id', bookingId);
    if (error) throw error;
    return 'no_match';
  }

  const { data, error } = await supabase.rpc('assign_cleaner', {
    p_booking_id: bookingId,
    p_candidate_ids: candidates,
    p_booking_date: booking.booking_date,
  });

  if (error) throw error;

  return (data as string).startsWith('matched') ? 'matched' : 'no_match';
}
