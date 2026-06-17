import { supabase } from '../lib/supabase';
import { matchCleaner, NO_MATCH, type BookingForMatch } from './matchingService';
import { issueRefund } from './refundService';

export type AssignResult = 'matched' | 'no_match';

/**
 * Selects the best available cleaner for a booking and atomically assigns them.
 *
 * Step 1 — matchCleaner(): produces a ranked candidate list (read-only queries).
 * Step 2 — assign_cleaner RPC: Postgres function that iterates the list with
 *   SELECT FOR UPDATE, claiming the first slot still free. If a candidate was
 *   taken by a concurrent booking, it falls back to the next in the list.
 *
 * Pass paystackReference when payment has already been captured — a no_match
 * outcome will trigger issueRefund() so the customer is never charged for a
 * booking that couldn't be fulfilled.
 *
 * On return: booking.status is 'matched' (cleaner assigned) or 'no_match'.
 */
export async function assignCleaner(
  bookingId: string,
  booking: BookingForMatch,
  paystackReference?: string,
): Promise<AssignResult> {
  const candidates = await matchCleaner(booking);

  if (candidates === NO_MATCH) {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'no_match', updated_at: new Date().toISOString() })
      .eq('id', bookingId);
    if (error) throw error;
    if (paystackReference) await issueRefund(bookingId, paystackReference);
    return 'no_match';
  }

  const { data, error } = await supabase.rpc('assign_cleaner', {
    p_booking_id: bookingId,
    p_candidate_ids: candidates,
    p_booking_date: booking.booking_date,
  });

  if (error) throw error;

  const result: AssignResult = (data as string).startsWith('matched') ? 'matched' : 'no_match';
  if (result === 'no_match' && paystackReference) await issueRefund(bookingId, paystackReference);
  return result;
}
