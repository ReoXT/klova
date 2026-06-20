import { supabase } from '../lib/supabase';
import { config } from '../config';

// ─── Error type ──────────────────────────────────────────────────────────────

export class TransportFareError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'TransportFareError';
    this.status = status;
  }
}

// ─── Input / output types ─────────────────────────────────────────────────────

export type ValidatedTransportFare =
  | { action: 'quote'; amount_ngn: number }
  | { action: 'waive' }
  | { action: 'not_required' };

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Pure synchronous validation — no DB calls.
 * Accepts exactly one of:
 *   { amount: <positive NGN number> }  — quote a fare
 *   { waive: true }                    — fare waived (Klova absorbs it)
 *   { not_required: true }             — no transport needed (Keeper is local)
 */
export function validateTransportFareInput(body: Record<string, unknown>): ValidatedTransportFare {
  const hasAmount    = body.amount       !== undefined && body.amount       !== null;
  const isWaive      = body.waive        === true;
  const isNotRequired = body.not_required === true;

  const flagCount = [hasAmount, isWaive, isNotRequired].filter(Boolean).length;
  if (flagCount === 0) {
    throw new TransportFareError(
      'Provide one of: amount (NGN), waive: true, or not_required: true.',
      400,
    );
  }
  if (flagCount > 1) {
    throw new TransportFareError(
      'Provide only one of: amount, waive: true, or not_required: true.',
      400,
    );
  }

  if (isNotRequired) return { action: 'not_required' };
  if (isWaive)       return { action: 'waive' };

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new TransportFareError('amount must be a positive number.', 422);
  }
  if (amount > config.transportFareCeilingNgn) {
    throw new TransportFareError(
      `amount ₦${amount.toLocaleString()} exceeds the maximum allowed transport fare of ₦${config.transportFareCeilingNgn.toLocaleString()}. Check for a typo.`,
      422,
    );
  }

  return { action: 'quote', amount_ngn: amount };
}

// ─── Booking update ───────────────────────────────────────────────────────────

export interface BookingTransportRow {
  id: string;
  status: string;
  cleaner_id: string;
  booking_date: string;
  address: string;
  total_amount_kobo: number;
  commission_kobo: number;
  transport_fare: number | null;
  transport_status: string;
  transport_payment_ref: string | null;
  transport_paid_at: string | null;
}

/**
 * Guards (in order):
 *  1. Booking exists
 *  2. Status is 'confirmed' (clean payment received)
 *  3. A Keeper is assigned (cleaner_id is not null)
 *  4. transport_status is 'pending_quote' (not already recorded)
 *
 * On success: updates transport_fare + transport_status and returns the row.
 * transport_fare is stored as NGN NUMERIC — it is NOT included in
 * total_amount_kobo or commission_kobo and never flows through the kobo engine.
 */
export async function recordTransportFare(
  bookingId: string,
  input: ValidatedTransportFare,
): Promise<BookingTransportRow> {
  const { data: booking, error: fetchErr } = await supabase
    .from('bookings')
    .select('id, status, cleaner_id, transport_status')
    .eq('id', bookingId)
    .single();

  if (fetchErr || !booking) {
    throw new TransportFareError(`Booking ${bookingId} not found.`, 404);
  }

  if (booking.status !== 'confirmed') {
    throw new TransportFareError(
      `Transport fare can only be recorded for confirmed bookings. This booking is "${booking.status}".`,
      409,
    );
  }

  if (!booking.cleaner_id) {
    throw new TransportFareError(
      'This booking has no assigned Keeper. Assign a Keeper before recording a transport fare.',
      409,
    );
  }

  if (booking.transport_status !== 'pending_quote') {
    throw new TransportFareError(
      `Transport fare is already recorded (status: "${booking.transport_status}").`,
      409,
    );
  }

  const updates =
    input.action === 'waive'        ? { transport_fare: 0,               transport_status: 'waived'           }
  : input.action === 'not_required' ? { transport_fare: null,            transport_status: 'not_required'     }
  :                                   { transport_fare: input.amount_ngn, transport_status: 'awaiting_payment' };

  const { data: updated, error: updateErr } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', bookingId)
    .select(
      'id, status, cleaner_id, booking_date, address, total_amount_kobo, commission_kobo, transport_fare, transport_status, transport_payment_ref, transport_paid_at',
    )
    .single();

  if (updateErr || !updated) {
    throw updateErr ?? new Error('Failed to update booking transport fare.');
  }

  return updated as BookingTransportRow;
}
