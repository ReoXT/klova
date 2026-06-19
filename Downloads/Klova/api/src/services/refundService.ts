import { supabase } from '../lib/supabase';
import { config } from '../config';
import { adjustEarningForRefund } from './earningsService';

/**
 * Issues a full Paystack refund for a booking and immediately adjusts the
 * cleaner's pending earning so it is never included in a payout run.
 *
 * Guards:
 *   - Booking not found
 *   - Booking has no paystack_reference (was never charged)
 *   - Booking already fully refunded (refund_kobo >= total_amount_kobo)
 *
 * On Paystack failure: throws so the caller can surface a 500.
 */
export async function issueRefund(bookingId: string, paystackReference: string): Promise<void> {
  const { data: booking, error: lookupErr } = await supabase
    .from('bookings')
    .select('id, paystack_reference, refund_kobo, total_amount_kobo, refunded_at')
    .eq('id', bookingId)
    .single();

  if (lookupErr || !booking) {
    console.error(`[refund] Booking ${bookingId} not found — skipping refund`);
    return;
  }

  if (!booking.paystack_reference) {
    console.warn(`[refund] Booking ${bookingId} has no payment reference — skipping refund`);
    return;
  }

  const totalKobo       = booking.total_amount_kobo as number;
  const alreadyRefunded = (booking.refund_kobo as number) >= totalKobo;
  if (alreadyRefunded) {
    console.warn(`[refund] Booking ${bookingId} already fully refunded — skipping`);
    return;
  }

  console.log(`[refund] Initiating refund for booking ${bookingId} (ref: ${paystackReference})`);

  const response = await fetch('https://api.paystack.co/refund', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.paystackSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ transaction: paystackReference }),
  });

  const body = await response.json() as { status: boolean; message: string };

  if (!response.ok || !body.status) {
    const msg = body.message ?? `HTTP ${response.status}`;
    console.error(`[refund] Paystack refund failed for booking ${bookingId}: ${msg}`);
    throw new Error(`Refund failed: ${msg}`);
  }

  // Mark booking as fully refunded — the refund.processed webhook will also fire
  // but adjustEarningForRefund is idempotent so calling it twice is safe
  const { error: updateErr } = await supabase
    .from('bookings')
    .update({ refunded_at: new Date().toISOString(), refund_kobo: totalKobo })
    .eq('id', bookingId);

  if (updateErr) {
    console.error(`[refund] Failed to update booking ${bookingId}:`, updateErr);
    throw updateErr;
  }

  // Zero out the cleaner's earning so it never reaches the payout queue
  await adjustEarningForRefund(bookingId, totalKobo, totalKobo);

  console.log(`[refund] Refund successful for booking ${bookingId} (ref: ${paystackReference})`);
}
