import { supabase } from '../lib/supabase';
import { notifyCustomerDispatchConfirmed, notifyKeeperDispatched } from './notificationService';

// ─── Error type ───────────────────────────────────────────────────────────────

export class DispatchError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'DispatchError';
    this.status = status;
  }
}

// ─── Transport gate ───────────────────────────────────────────────────────────

// Only these transport statuses allow dispatch. Any other value is a hard block.
const TRANSPORT_DISPATCH_ALLOWED = new Set(['paid', 'waived', 'not_required']);

// ─── Confirm dispatch ─────────────────────────────────────────────────────────

export interface DispatchedBooking {
  id: string;
  status: string;
  transport_status: string;
  dispatched_at: string;
}

/**
 * Hard-gates dispatch on transport being settled.
 *
 * Guards (in order):
 *  1. Booking exists
 *  2. booking.status is 'confirmed' (clean payment received, cleaner already assigned)
 *  3. dispatched_at is null (not already dispatched — use resend for notifications)
 *  4. transport_status ∈ {paid, waived, not_required} — HARD BLOCK otherwise
 *
 * On pass: stamps dispatched_at, sends "you're all set" to customer and
 * "go time" to Keeper. Both notifications use safeSend — they never throw.
 *
 * This is the ONLY place notifyCustomerDispatchConfirmed and
 * notifyKeeperDispatched are called. They must never be triggered directly
 * from any other path (webhook, cron, or other admin action).
 */
export async function confirmDispatch(bookingId: string): Promise<DispatchedBooking> {
  const { data: booking, error: fetchErr } = await supabase
    .from('bookings')
    .select('id, status, transport_status, transport_fare, dispatched_at')
    .eq('id', bookingId)
    .single();

  if (fetchErr || !booking) {
    throw new DispatchError(`Booking ${bookingId} not found.`, 404);
  }

  if (booking.status !== 'confirmed') {
    throw new DispatchError(
      `Dispatch requires a confirmed booking. This booking is "${booking.status as string}".`,
      409,
    );
  }

  if (booking.dispatched_at) {
    throw new DispatchError(
      'This booking has already been dispatched.',
      409,
    );
  }

  // ── Transport gate ─────────────────────────────────────────────────────────
  const ts = booking.transport_status as string;

  if (!TRANSPORT_DISPATCH_ALLOWED.has(ts)) {
    if (ts === 'awaiting_payment') {
      const fareDisplay = booking.transport_fare
        ? `₦${Number(booking.transport_fare).toLocaleString('en-NG')}`
        : 'the transport fare';
      throw new DispatchError(
        `Transport fare not yet paid — cannot dispatch. ` +
        `The customer has been invoiced ${fareDisplay}. ` +
        `Dispatch once payment is received, or waive the fare.`,
        409,
      );
    }
    // pending_quote (and any unexpected value)
    throw new DispatchError(
      'Transport fare not yet quoted — cannot dispatch. ' +
      'Quote a fare, waive it, or mark it as not required first.',
      409,
    );
  }
  // ── Gate passed ────────────────────────────────────────────────────────────

  const now = new Date().toISOString();
  const { data: updated, error: updateErr } = await supabase
    .from('bookings')
    .update({ dispatched_at: now })
    .eq('id', bookingId)
    .select('id, status, transport_status, dispatched_at')
    .single();

  if (updateErr || !updated) {
    throw updateErr ?? new Error('Failed to mark booking as dispatched.');
  }

  console.log(`[dispatch] Booking ${bookingId} dispatched (transport: ${ts})`);

  // Fire both notifications — safeSend inside each so they never throw.
  await notifyCustomerDispatchConfirmed(bookingId);
  await notifyKeeperDispatched(bookingId);

  return updated as DispatchedBooking;
}
