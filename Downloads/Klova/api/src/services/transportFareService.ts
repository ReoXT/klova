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
  | {
      action: 'quote';
      amount_ngn: number;             // total fare (sum for multi-keeper)
      keeper_amounts_ngn?: number[];  // per-keeper breakdown, lead first (omitted for 1-keeper single-amount input)
    }
  | { action: 'waive' }
  | { action: 'not_required' };

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Pure synchronous validation — no DB calls.
 * Accepts exactly one of:
 *   { amount: <NGN> }                           — single fare (1-keeper bookings)
 *   { keeper_amounts: [<NGN>, <NGN>] }          — per-keeper fares (2-keeper bookings)
 *   { waive: true }                             — fare waived (Klova absorbs it)
 *   { not_required: true }                      — no transport needed (Keeper is local)
 *
 * For 2-keeper bookings the admin must use keeper_amounts so each keeper's
 * reimbursement can be tracked independently. The sum becomes the customer invoice.
 */
export function validateTransportFareInput(body: Record<string, unknown>): ValidatedTransportFare {
  const hasAmount      = body.amount         != null;
  const hasKeeperAmts  = body.keeper_amounts != null;
  const isWaive        = body.waive          === true;
  const isNotRequired  = body.not_required   === true;

  if (hasAmount && hasKeeperAmts) {
    throw new TransportFareError(
      'Provide either amount or keeper_amounts — not both.',
      400,
    );
  }

  const flagCount = [hasAmount || hasKeeperAmts, isWaive, isNotRequired].filter(Boolean).length;
  if (flagCount === 0) {
    throw new TransportFareError(
      'Provide one of: amount (NGN), keeper_amounts ([NGN, …]), waive: true, or not_required: true.',
      400,
    );
  }
  if (flagCount > 1) {
    throw new TransportFareError(
      'Provide only one of: amount, keeper_amounts, waive: true, or not_required: true.',
      400,
    );
  }

  if (isNotRequired) return { action: 'not_required' };
  if (isWaive)       return { action: 'waive' };

  // ── keeper_amounts: per-keeper array ─────────────────────────────────────
  if (hasKeeperAmts) {
    const raw = body.keeper_amounts;
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 2) {
      throw new TransportFareError(
        'keeper_amounts must be an array of 1–2 positive NGN amounts (one per assigned keeper).',
        400,
      );
    }
    const amounts = (raw as unknown[]).map((a) => Number(a));
    for (const a of amounts) {
      if (!Number.isFinite(a) || a <= 0) {
        throw new TransportFareError('Each keeper amount must be a positive number.', 422);
      }
      if (a > config.transportFareCeilingNgn) {
        throw new TransportFareError(
          `Keeper amount ₦${a.toLocaleString()} exceeds the maximum allowed fare of ₦${config.transportFareCeilingNgn.toLocaleString()}.`,
          422,
        );
      }
    }
    const total = amounts.reduce((s, a) => s + a, 0);
    return { action: 'quote', amount_ngn: total, keeper_amounts_ngn: amounts };
  }

  // ── amount: single fare (1-keeper or legacy path) ────────────────────────
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
  transport_awaiting_since: string | null;
}

/**
 * Guards (in order):
 *  1. Booking exists
 *  2. Status is 'confirmed' (clean payment received)
 *  3. At least one Keeper is assigned (cleaner_id is not null)
 *  4. transport_status is 'pending_quote' (not already recorded)
 *
 * For 2-keeper bookings the input MUST use keeper_amounts (not a single amount)
 * so each keeper's reimbursement can be stored independently on booking_cleaners.
 * The booking-level transport_fare is always the SUM of all keepers' fares —
 * that is what the customer is invoiced for via the existing Paystack PRQ flow.
 *
 * transport_fare is stored as NGN NUMERIC — it is NOT included in
 * total_amount_kobo or commission_kobo and never flows through the kobo engine.
 */
export async function recordTransportFare(
  bookingId: string,
  input: ValidatedTransportFare,
): Promise<BookingTransportRow> {
  // ── 1. Booking guards ─────────────────────────────────────────────────────
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

  // ── 2. Load assigned keepers from booking_cleaners (lead first) ───────────
  const { data: keeperRows, error: kErr } = await supabase
    .from('booking_cleaners')
    .select('id, cleaner_id')
    .eq('booking_id', bookingId)
    .order('role', { ascending: true }); // 'lead' < 'second'

  if (kErr) throw kErr;
  const keepers = (keeperRows ?? []) as { id: string; cleaner_id: string }[];

  // ── 3. Compute per-keeper fares (kobo) and derive booking total (NGN) ────
  //
  // For a quote, the admin must supply exactly one amount per keeper:
  //   1-keeper → { amount: N }  or  { keeper_amounts: [N] }
  //   2-keeper → { keeper_amounts: [N1, N2] }   (single amount is rejected)
  //
  // For waive/not_required the per-keeper amount is 0/null — no reimbursement.

  let perKeeperKobo: (number | null)[] = keepers.map(() => null);

  if (input.action === 'quote') {
    const amts = input.keeper_amounts_ngn ?? [input.amount_ngn];

    if (keepers.length > 1 && !input.keeper_amounts_ngn) {
      throw new TransportFareError(
        `This booking has ${keepers.length} keepers. Use keeper_amounts: [fare1, fare2] so each keeper's reimbursement can be tracked independently.`,
        400,
      );
    }
    if (keepers.length > 0 && amts.length !== keepers.length) {
      throw new TransportFareError(
        `keeper_amounts has ${amts.length} entr${amts.length === 1 ? 'y' : 'ies'} but this booking has ${keepers.length} keeper(s).`,
        400,
      );
    }

    perKeeperKobo = amts.map((a) => Math.round(a * 100));
  } else if (input.action === 'waive') {
    perKeeperKobo = keepers.map(() => 0);
  }
  // not_required → stays null for all keepers

  // ── 4. Update booking-level transport_fare = sum of all keeper fares ──────
  //
  // The existing Paystack PRQ invoice flow reads bookings.transport_fare and
  // creates ONE invoice for the customer. No change needed in that flow.
  const updates =
    input.action === 'waive'        ? { transport_fare: 0,               transport_status: 'waived',           transport_awaiting_since: null }
  : input.action === 'not_required' ? { transport_fare: null,            transport_status: 'not_required',     transport_awaiting_since: null }
  :                                   { transport_fare: input.amount_ngn, transport_status: 'awaiting_payment', transport_awaiting_since: new Date().toISOString() };

  const { data: updated, error: updateErr } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', bookingId)
    .select(
      'id, status, cleaner_id, booking_date, address, total_amount_kobo, commission_kobo, transport_fare, transport_status, transport_payment_ref, transport_paid_at, transport_awaiting_since',
    )
    .single();

  if (updateErr || !updated) {
    throw updateErr ?? new Error('Failed to update booking transport fare.');
  }

  // ── 5. Write per-keeper reimbursement amounts to booking_cleaners ─────────
  //
  // Each keeper's booking_cleaners.transport_fare_kobo is what they are owed
  // in the weekly payout — independent of the other keeper's amount.
  for (let i = 0; i < keepers.length; i++) {
    const { error: bcErr } = await supabase
      .from('booking_cleaners')
      .update({ transport_fare_kobo: perKeeperKobo[i] })
      .eq('id', keepers[i].id);

    if (bcErr) {
      console.error(
        `[transport-fare] Failed to write transport_fare_kobo for keeper ${keepers[i].cleaner_id} ` +
        `on booking ${bookingId}: ${bcErr.message}`,
      );
    }
  }

  return updated as BookingTransportRow;
}
