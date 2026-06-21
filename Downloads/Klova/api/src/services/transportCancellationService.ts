import { supabase } from '../lib/supabase';
import { config } from '../config';
import { notifyKeeperJobCancelled } from './notificationService';
import { issueRefund } from './refundService';
import { issueTransportRefund } from './transportInvoiceService';

// ─── Error type ───────────────────────────────────────────────────────────────

export class TransportCancellationError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'TransportCancellationError';
    this.status = status;
  }
}

// ─── Deadline helpers ─────────────────────────────────────────────────────────

// Lagos is WAT = UTC+1, no DST. Cheaper than Intl.DateTimeFormat for a date comparison.
function todayLagos(): string {
  const lagosMs = Date.now() + 60 * 60 * 1000;
  return new Date(lagosMs).toISOString().split('T')[0]!; // 'YYYY-MM-DD'
}

function hoursElapsed(since: string | null): number {
  if (!since) return Infinity; // no timestamp = treat as maximally overdue
  return (Date.now() - new Date(since).getTime()) / (1000 * 60 * 60);
}

// ─── Admin cockpit: list awaiting-transport bookings ─────────────────────────

export interface AwaitingTransportBooking {
  id: string;
  booking_date: string;
  time_slot: string | null;
  address: string;
  transport_fare: number;
  transport_awaiting_since: string | null;
  customer: { first_name: string; last_name: string; email: string | null; phone: string } | null;
  cleaner: { first_name: string; last_name: string; phone: string } | null;
  // computed
  hours_waiting: number;
  is_soft_overdue: boolean;  // past the configurable deadline (default 24 h)
  is_booking_date_passed: boolean; // booking date is in the past — hard deadline
  is_overdue: boolean;       // either condition above
}

/**
 * Returns all confirmed bookings with transport_status='awaiting_payment',
 * enriched with deadline state so the admin knows which need action.
 *
 * No writes — pure read.
 */
export async function getAwaitingTransportBookings(): Promise<AwaitingTransportBooking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      booking_date,
      time_slot,
      address,
      transport_fare,
      transport_awaiting_since,
      customers:customer_id (first_name, last_name, email, phone),
      cleaners:cleaner_id  (first_name, last_name, phone)
    `)
    .eq('status', 'confirmed')
    .eq('transport_status', 'awaiting_payment')
    .order('booking_date', { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const today = todayLagos();
  const deadlineHours = config.transportPaymentDeadlineHours;

  return data.map((row) => {
    const hours = hoursElapsed(row.transport_awaiting_since as string | null);
    const bookingDatePassed = (row.booking_date as string) < today;
    const softOverdue = hours > deadlineHours;

    return {
      id:                      row.id as string,
      booking_date:            row.booking_date as string,
      time_slot:               (row.time_slot as string | null) ?? null,
      address:                 row.address as string,
      transport_fare:          row.transport_fare as number,
      transport_awaiting_since: (row.transport_awaiting_since as string | null) ?? null,
      customer:                row.customers as unknown as AwaitingTransportBooking['customer'],
      cleaner:                 row.cleaners  as unknown as AwaitingTransportBooking['cleaner'],
      hours_waiting:           Math.round(hours * 10) / 10, // 1 d.p.
      is_soft_overdue:         softOverdue,
      is_booking_date_passed:  bookingDatePassed,
      is_overdue:              softOverdue || bookingDatePassed,
    };
  });
}

// ─── Admin action: cancel an overdue booking ──────────────────────────────────

export interface CancelledTransportBooking {
  id: string;
  status: string;
  transport_status: string;
  cancellation_reason: string;
}

/**
 * Cancels a booking whose transport fare was never paid.
 *
 * Guards (in order):
 *  1. Booking exists
 *  2. status === 'confirmed' (already paid for clean, but not yet dispatched)
 *  3. transport_status === 'awaiting_payment'
 *
 * Actions (in order):
 *  1. Flip booking.status → 'cancelled', record cancellation_reason
 *  2. Free the Keeper's cleaner_availability slot (is_booked → false)
 *  3. Notify the Keeper — their date is freed, expect a new assignment
 *
 * IMPORTANT: The customer's clean payment is NOT refunded. Transport non-payment
 * is not a refund event — the customer chose not to complete the booking flow.
 * Refunds only happen if the Keeper doesn't show up and we can't reassign.
 */
export async function cancelTransportOverdue(bookingId: string): Promise<CancelledTransportBooking> {
  const { data: booking, error: fetchErr } = await supabase
    .from('bookings')
    .select('id, status, transport_status, cleaner_id, booking_date')
    .eq('id', bookingId)
    .single();

  if (fetchErr || !booking) {
    throw new TransportCancellationError(`Booking ${bookingId} not found.`, 404);
  }

  if (booking.status === 'cancelled') {
    throw new TransportCancellationError(
      'This booking is already cancelled.',
      409,
    );
  }

  if (booking.status !== 'confirmed') {
    throw new TransportCancellationError(
      `Only confirmed bookings can be cancelled via this endpoint. This booking is "${booking.status as string}".`,
      409,
    );
  }

  if (booking.transport_status !== 'awaiting_payment') {
    throw new TransportCancellationError(
      `This booking's transport status is "${booking.transport_status as string}" — only bookings awaiting transport payment can be cancelled here.`,
      409,
    );
  }

  // ── 1. Cancel the booking ──────────────────────────────────────────────────
  const { data: updated, error: cancelErr } = await supabase
    .from('bookings')
    .update({
      status:              'cancelled',
      cancellation_reason: 'transport_payment_overdue',
    })
    .eq('id', bookingId)
    .select('id, status, transport_status, cancellation_reason')
    .single();

  if (cancelErr || !updated) {
    throw cancelErr ?? new Error('Failed to cancel booking.');
  }

  // ── 2. Free the Keeper's availability slot ─────────────────────────────────
  if (booking.cleaner_id) {
    const { error: availErr } = await supabase
      .from('cleaner_availability')
      .update({ is_booked: false })
      .eq('cleaner_id', booking.cleaner_id as string)
      .eq('available_date', booking.booking_date as string);

    if (availErr) {
      // Non-fatal — log but don't block. Admin can manually fix in Supabase if needed.
      console.error(
        `[transport-cancel] Failed to free availability for cleaner ${booking.cleaner_id as string} on ${booking.booking_date as string}:`,
        availErr.message,
      );
    } else {
      console.log(
        `[transport-cancel] Freed slot: cleaner ${booking.cleaner_id as string} on ${booking.booking_date as string}`,
      );
    }
  }

  console.log(`[transport-cancel] Booking ${bookingId} cancelled — transport payment overdue`);

  // ── 3. Notify the Keeper ───────────────────────────────────────────────────
  // safeSend inside — never throws. Keeper gets SMS + WhatsApp.
  await notifyKeeperJobCancelled(bookingId);

  return updated as CancelledTransportBooking;
}

// ─── Admin action: cancel a confirmed booking with refunds ────────────────────

export type CleanRefundOutcome =
  | 'issued'
  | 'skipped_already_refunded'
  | 'skipped_no_ref'
  | 'failed';

export type TransportRefundOutcome =
  | 'issued'
  | 'skipped_not_paid'
  | 'skipped_no_tx_ref'
  | 'failed';

export interface CancelledConfirmedBooking {
  id: string;
  status: string;
  clean_refund: CleanRefundOutcome;
  transport_refund: TransportRefundOutcome;
}

/**
 * Admin-triggered cancellation for a confirmed booking, regardless of transport state.
 *
 * Guards (in order):
 *  1. Booking exists
 *  2. status === 'confirmed' (clean payment received; pre-dispatch)
 *  3. Not already cancelled
 *  4. dispatched_at is null — once the Keeper is moving, refund policy is different
 *     and manual review is required
 *
 * Actions:
 *  1. Cancel the booking (status → 'cancelled', reason = 'admin_cancelled')
 *  2. Free the Keeper's availability slot
 *  3. Refund the clean payment via Paystack (issueRefund)
 *  4. If transport_status === 'paid':
 *       a. transport_transaction_ref present → issue Paystack refund automatically
 *       b. transport_transaction_ref null    → log MANUAL ACTION REQUIRED and return
 *          outcome 'skipped_no_tx_ref' so the caller surfaces it in the response
 *  5. Notify the Keeper
 *
 * Clean refund uses the existing issueRefund which is idempotent and adjusts
 * cleaner earnings. Transport refund does NOT touch commission (transport is
 * pass-through — it was never included in revenue).
 */
interface ConfirmedBookingRow {
  id: string;
  status: string;
  cleaner_id: string | null;
  booking_date: string;
  paystack_reference: string | null;
  dispatched_at: string | null;
  transport_status: string;
  transport_fare: number | null;
  transport_payment_ref: string | null;
  transport_transaction_ref: string | null;
}

export async function cancelConfirmedBooking(bookingId: string): Promise<CancelledConfirmedBooking> {
  const { data: raw, error: fetchErr } = await supabase
    .from('bookings')
    .select('id, status, cleaner_id, booking_date, paystack_reference, dispatched_at, transport_status, transport_fare, transport_payment_ref, transport_transaction_ref')
    .eq('id', bookingId)
    .single();

  if (fetchErr || !raw) {
    throw new TransportCancellationError(`Booking ${bookingId} not found.`, 404);
  }

  const booking = raw as unknown as ConfirmedBookingRow;

  if (booking.status === 'cancelled') {
    throw new TransportCancellationError('This booking is already cancelled.', 409);
  }

  if (booking.status !== 'confirmed') {
    throw new TransportCancellationError(
      `Only confirmed bookings can be cancelled here. This booking is "${booking.status}".`,
      409,
    );
  }

  if (booking.dispatched_at) {
    throw new TransportCancellationError(
      'This booking has already been dispatched — the Keeper may be en route. ' +
      'Manual review is required before cancellation.',
      409,
    );
  }

  // ── 1. Cancel the booking ──────────────────────────────────────────────────
  const { data: updated, error: cancelErr } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', cancellation_reason: 'admin_cancelled' })
    .eq('id', bookingId)
    .select('id, status, cancellation_reason')
    .single();

  if (cancelErr || !updated) {
    throw cancelErr ?? new Error('Failed to cancel booking.');
  }

  console.log(`[cancel-booking] Booking ${bookingId} cancelled by admin`);

  // ── 2. Free the Keeper's slot ──────────────────────────────────────────────
  if (booking.cleaner_id) {
    const { error: availErr } = await supabase
      .from('cleaner_availability')
      .update({ is_booked: false })
      .eq('cleaner_id', booking.cleaner_id)
      .eq('available_date', booking.booking_date);

    if (availErr) {
      console.error(
        `[cancel-booking] Failed to free slot for cleaner ${booking.cleaner_id} ` +
        `on ${booking.booking_date}: ${availErr.message}`,
      );
    } else {
      console.log(
        `[cancel-booking] Freed slot: cleaner ${booking.cleaner_id} on ${booking.booking_date}`,
      );
    }
  }

  // ── 3. Refund the clean payment ────────────────────────────────────────────
  let clean_refund: CleanRefundOutcome = 'skipped_no_ref';
  if (booking.paystack_reference) {
    try {
      await issueRefund(bookingId, booking.paystack_reference);
      clean_refund = 'issued';
    } catch (err) {
      console.error(
        `[cancel-booking] Clean refund FAILED for booking ${bookingId}: ${(err as Error).message}. ` +
        `Issue manually via Paystack dashboard (ref: ${booking.paystack_reference}).`,
      );
      clean_refund = 'failed';
    }
  } else {
    console.warn(`[cancel-booking] No paystack_reference on booking ${bookingId} — clean refund skipped`);
  }

  // ── 4. Refund transport if paid ────────────────────────────────────────────
  let transport_refund: TransportRefundOutcome = 'skipped_not_paid';

  if (booking.transport_status === 'paid') {
    const txRef = booking.transport_transaction_ref;
    if (txRef) {
      try {
        await issueTransportRefund(bookingId, txRef);
        transport_refund = 'issued';
      } catch (err) {
        console.error(
          `[cancel-booking] Transport refund FAILED for booking ${bookingId} (tx: ${txRef}): ` +
          `${(err as Error).message}. Issue manually via Paystack dashboard.`,
        );
        transport_refund = 'failed';
      }
    } else {
      // Transport was paid but the transaction reference was never captured.
      // This can happen for bookings paid before the 2026-06-21 webhook update.
      console.error(
        `[cancel-booking] MANUAL ACTION REQUIRED — Booking ${bookingId} has paid transport ` +
        `(PRQ: ${booking.transport_payment_ref ?? 'unknown'}, ` +
        `₦${Number(booking.transport_fare ?? 0).toLocaleString('en-NG')}) ` +
        `but transport_transaction_ref is null. Refund this amount manually via the Paystack dashboard.`,
      );
      transport_refund = 'skipped_no_tx_ref';
    }
  }

  // ── 5. Notify the Keeper ───────────────────────────────────────────────────
  await notifyKeeperJobCancelled(bookingId);

  return {
    id:               updated.id as string,
    status:           updated.status as string,
    clean_refund,
    transport_refund,
  };
}
