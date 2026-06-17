import { supabase } from '../lib/supabase';
import { config } from '../config';

/**
 * Issues a Paystack refund for a booking that was paid but could not be fulfilled.
 *
 * Guards (all logged and silently skipped):
 *   - Booking not found
 *   - Booking has no paystack_reference (was never charged)
 *   - Booking already has refunded_at set (double-refund protection)
 *
 * On success: sets refunded_at on the booking row.
 * On Paystack failure: throws so the caller (webhook handler) can surface a 500
 *   and allow Paystack to retry delivery.
 */
export async function issueRefund(bookingId: string, paystackReference: string): Promise<void> {
  // ── Guard: load booking and check preconditions ──────────────────────────────
  const { data: booking, error: lookupErr } = await supabase
    .from('bookings')
    .select('id, paystack_reference, refunded_at')
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

  if (booking.refunded_at) {
    console.warn(`[refund] Booking ${bookingId} already refunded at ${booking.refunded_at} — skipping`);
    return;
  }

  // ── Issue refund via Paystack ─────────────────────────────────────────────────
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

  // ── Mark refunded in DB ───────────────────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from('bookings')
    .update({ refunded_at: new Date().toISOString() })
    .eq('id', bookingId);

  if (updateErr) {
    console.error(`[refund] Failed to set refunded_at for booking ${bookingId}:`, updateErr);
    throw updateErr;
  }

  console.log(`[refund] Refund successful for booking ${bookingId} (ref: ${paystackReference})`);
}
