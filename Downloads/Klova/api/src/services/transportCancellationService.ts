import { supabase } from '../lib/supabase';
import { config } from '../config';
import { notifyKeeperJobCancelled } from './notificationService';

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
