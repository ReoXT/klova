import { supabase } from '../lib/supabase';

export class ReassignError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ReassignError';
    this.status = status;
  }
}

export interface ReassignKeeperResult {
  rpc_result: string;
  earnings_transferred: boolean;
}

/**
 * Atomically reassigns a single keeper slot (lead or second) on a booking.
 *
 * Steps:
 *  1. Validate booking exists and is in a reassignable state.
 *  2. Call admin_reassign_keeper RPC (handles availability + booking_cleaners atomically).
 *  3. If the booking is already 'completed', transfer the old keeper's cleaner_earnings
 *     row to the new keeper — same amount, same status — so the payout queue stays correct.
 *
 * Raises ReassignError with appropriate HTTP status on failure.
 */
export async function reassignKeeper(
  bookingId: string,
  role: 'lead' | 'second',
  newCleanerId: string,
): Promise<ReassignKeeperResult> {
  const REASSIGNABLE = ['pending_payment', 'matched', 'confirmed', 'completed', 'no_match'];

  // 1. Load booking
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('booking_date, status, cleaner_id')
    .eq('id', bookingId)
    .single();

  if (bookingErr || !booking) {
    throw new ReassignError('Booking not found.', 404);
  }
  if (!REASSIGNABLE.includes(booking.status as string)) {
    throw new ReassignError(
      `Cannot reassign a ${booking.status as string} booking.`,
      422,
    );
  }

  // 2. Find old cleaner for this role (for earnings transfer later)
  const { data: bcRow } = await supabase
    .from('booking_cleaners')
    .select('cleaner_id')
    .eq('booking_id', bookingId)
    .eq('role', role)
    .maybeSingle();

  const oldCleanerId = (bcRow?.cleaner_id as string | null) ?? null;

  // 3. Call RPC (availability + booking_cleaners atomically)
  const { data: rpcResult, error: rpcErr } = await supabase.rpc('admin_reassign_keeper', {
    p_booking_id:     bookingId,
    p_role:           role,
    p_new_cleaner_id: newCleanerId,
    p_booking_date:   booking.booking_date as string,
  });

  if (rpcErr) {
    if (rpcErr.message?.includes('cleaner_unavailable')) {
      throw new ReassignError(
        'That cleaner is no longer available for this date. Refresh and try again.',
        409,
      );
    }
    if (rpcErr.message?.includes('duplicate_keeper')) {
      throw new ReassignError(
        'That cleaner is already assigned to the other slot on this booking.',
        422,
      );
    }
    throw rpcErr;
  }

  // 4. Earnings transfer (only for completed bookings, only if keeper actually changed)
  let earningsTransferred = false;
  if (
    booking.status === 'completed' &&
    oldCleanerId &&
    oldCleanerId !== newCleanerId
  ) {
    earningsTransferred = await transferKeeperEarning(bookingId, oldCleanerId, newCleanerId);
  }

  return {
    rpc_result:           rpcResult as string,
    earnings_transferred: earningsTransferred,
  };
}

/**
 * Moves a cleaner_earnings row from oldCleanerId to newCleanerId for a booking.
 *
 * Rules:
 *  - If no earnings row exists for the old keeper, this is a no-op (returns false).
 *  - If the old keeper's earnings are already 'paid', we cannot claw them back —
 *    logs a warning and returns false (manual intervention needed).
 *  - Otherwise, deletes the old row and inserts a new one for the new keeper with
 *    the same earning_kobo and status.
 *
 * Returns true if an earnings row was transferred, false if skipped.
 */
export async function transferKeeperEarning(
  bookingId: string,
  oldCleanerId: string,
  newCleanerId: string,
): Promise<boolean> {
  const { data: oldEarning } = await supabase
    .from('cleaner_earnings')
    .select('id, earning_kobo, status')
    .eq('booking_id', bookingId)
    .eq('cleaner_id', oldCleanerId)
    .maybeSingle();

  if (!oldEarning) return false; // Not yet recorded — nothing to transfer

  const earning = oldEarning as { id: string; earning_kobo: number; status: string };

  if (earning.status === 'paid') {
    console.warn(
      `[reassign] Keeper ${oldCleanerId} earnings for booking ${bookingId} are already paid — ` +
      `manual review needed for transfer to ${newCleanerId}`,
    );
    return false;
  }

  // Delete old row
  const { error: delErr } = await supabase
    .from('cleaner_earnings')
    .delete()
    .eq('id', earning.id);

  if (delErr) throw delErr;

  // Insert new row for incoming keeper
  const { error: insErr } = await supabase
    .from('cleaner_earnings')
    .insert({
      booking_id:   bookingId,
      cleaner_id:   newCleanerId,
      earning_kobo: earning.earning_kobo,
      status:       earning.status,
    });

  if (insErr) throw insErr;

  return true;
}
