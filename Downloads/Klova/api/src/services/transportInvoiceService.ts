import { supabase } from '../lib/supabase';
import { config } from '../config';
import { TransportFareError } from './transportFareService';
import { notifyAdminTransportPaid } from './notificationService';
import { flagIfWalletNegative } from './walletGuardService';

// ─── Paystack response types ──────────────────────────────────────────────────

interface PaystackInvoiceResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    request_code: string;    // PRQ_xxxx — stored in transport_payment_ref
    offline_reference: string;
    amount: number;
    paid: boolean;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function paystackPost(path: string, body?: unknown): Promise<unknown> {
  if (!config.paystackSecretKey) {
    throw new TransportFareError('Paystack is not configured.', 503);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  let res: globalThis.Response;
  try {
    res = await fetch(`https://api.paystack.co${path}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'AbortError') {
      throw new TransportFareError('Paystack timed out. Try again in a moment.', 504);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const json = await res.json().catch(() => ({})) as { status?: boolean; message?: string };
  if (!res.ok || !json.status) {
    throw new TransportFareError(
      json.message ?? `Paystack returned HTTP ${res.status}.`,
      502,
    );
  }
  return json;
}

// ─── Create transport Payment Request ────────────────────────────────────────

export interface TransportInvoiceResult {
  request_code: string;
  offline_reference: string;
  booking_id: string;
  transport_fare: number;
  transport_status: string;
  transport_payment_ref: string;
}

export async function createTransportInvoice(bookingId: string): Promise<TransportInvoiceResult> {
  // Fetch booking + customer email in one query
  const { data: booking, error: fetchErr } = await supabase
    .from('bookings')
    .select(
      'id, transport_fare, transport_status, transport_payment_ref, paystack_reference, customers(email)',
    )
    .eq('id', bookingId)
    .single();

  if (fetchErr || !booking) {
    throw new TransportFareError(`Booking ${bookingId} not found.`, 404);
  }
  if (booking.transport_status !== 'awaiting_payment') {
    throw new TransportFareError(
      `Transport invoice can only be created when transport_status is "awaiting_payment". Current: "${booking.transport_status as string}".`,
      409,
    );
  }
  if (booking.transport_payment_ref) {
    throw new TransportFareError(
      `A Payment Request already exists for this booking (${booking.transport_payment_ref as string}). Use the resend endpoint instead.`,
      409,
    );
  }
  if (!booking.transport_fare || Number(booking.transport_fare) <= 0) {
    throw new TransportFareError('transport_fare is missing or zero — cannot create an invoice.', 422);
  }

  const customerData = booking.customers as unknown as { email?: string } | null;
  if (!customerData?.email) {
    throw new TransportFareError('Customer email is required to send a Paystack invoice.', 422);
  }

  const fareNgn = Number(booking.transport_fare);
  const fareKobo = Math.round(fareNgn * 100);
  const shortRef = (bookingId as string).slice(0, 8).toUpperCase();

  const payload = await paystackPost('/paymentrequest', {
    customer: customerData.email,
    amount: fareKobo,
    line_items: [
      {
        name: `Transport fare — Klova booking ${shortRef}`,
        amount: fareKobo,
        quantity: 1,
      },
    ],
    send_notification: true,
    metadata: {
      booking_id: bookingId,
      custom_fields: [
        { display_name: 'Booking ID', variable_name: 'booking_id', value: bookingId },
      ],
    },
  }) as PaystackInvoiceResponse;

  const { request_code, offline_reference } = payload.data;

  // Persist the reference so the webhook can tie the payment back to the booking.
  // If this DB write fails, the PRQ already exists on Paystack. Log the PRQ code
  // prominently so it can be manually linked or cancelled if the retry duplicates it.
  const { data: updated, error: updateErr } = await supabase
    .from('bookings')
    .update({ transport_payment_ref: request_code })
    .eq('id', bookingId)
    .select('id, transport_fare, transport_status, transport_payment_ref')
    .single();

  if (updateErr || !updated) {
    console.error(
      `[transport-invoice] ORPHANED PRQ — Paystack created ${request_code} for booking ${bookingId} ` +
      `but DB update failed. Manual action may be needed: link PRQ ${request_code} to the booking ` +
      `or cancel it at https://dashboard.paystack.com. Error: ${updateErr?.message ?? 'unknown'}`,
    );
    throw updateErr ?? new Error('Failed to store transport_payment_ref on booking.');
  }

  console.log(`[transport-invoice] Created PRQ ${request_code} for booking ${bookingId} (₦${fareNgn})`);

  return {
    request_code,
    offline_reference,
    booking_id: bookingId,
    transport_fare: fareNgn,
    transport_status: updated.transport_status as string,
    transport_payment_ref: request_code,
  };
}

// ─── Resend existing Payment Request ─────────────────────────────────────────

export async function resendTransportInvoice(bookingId: string): Promise<{ message: string }> {
  const { data: booking, error: fetchErr } = await supabase
    .from('bookings')
    .select('id, transport_status, transport_payment_ref')
    .eq('id', bookingId)
    .single();

  if (fetchErr || !booking) {
    throw new TransportFareError(`Booking ${bookingId} not found.`, 404);
  }
  if (!booking.transport_payment_ref) {
    throw new TransportFareError(
      'No Payment Request exists for this booking yet. Create one first.',
      409,
    );
  }
  if (booking.transport_status !== 'awaiting_payment') {
    throw new TransportFareError(
      `Resend is only valid when transport_status is "awaiting_payment". Current: "${booking.transport_status as string}".`,
      409,
    );
  }

  const requestCode = booking.transport_payment_ref as string;
  await paystackPost(`/paymentrequest/notify/${requestCode}`);

  console.log(`[transport-invoice] Re-sent PRQ ${requestCode} for booking ${bookingId}`);
  return { message: `Invoice ${requestCode} re-sent to customer.` };
}

// ─── Webhook: invoice.payment_successful ─────────────────────────────────────
// Called from webhookController when Paystack fires invoice.payment_successful.
// Idempotent: safe to call more than once for the same request_code.
// transactionRef: the Paystack transaction reference from the webhook's transactions
// array — stored so a cancellation can issue a refund later if needed.

export async function handleTransportInvoicePaid(
  requestCode: string,
  transactionRef: string | null = null,
): Promise<void> {
  const { data: booking, error: fetchErr } = await supabase
    .from('bookings')
    .select('id, transport_status')
    .eq('transport_payment_ref', requestCode)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!booking) {
    console.warn(`[transport-invoice] No booking found for PRQ ${requestCode}`);
    return;
  }
  if (booking.transport_status === 'paid') {
    // Already processed — duplicate webhook delivery
    return;
  }

  await supabase
    .from('bookings')
    .update({
      transport_status: 'paid',
      transport_paid_at: new Date().toISOString(),
      ...(transactionRef ? { transport_transaction_ref: transactionRef } : {}),
    })
    .eq('id', booking.id as string);

  if (!transactionRef) {
    // Without the transaction ref we cannot issue an automated refund later.
    // This should not happen with a correctly shaped Paystack webhook, but log
    // it clearly so any discrepancy is visible in Railway logs.
    console.warn(
      `[transport-invoice] PRQ ${requestCode} paid (booking ${booking.id as string}) — ` +
      `no transaction reference in webhook payload. If this booking is later cancelled, ` +
      `the transport refund must be issued manually via the Paystack dashboard.`,
    );
  } else {
    console.log(
      `[transport-invoice] PRQ ${requestCode} paid — booking ${booking.id as string} ` +
      `transport_status → paid (tx: ${transactionRef})`,
    );
  }

  await notifyAdminTransportPaid(booking.id as string);
}

// ─── Issue transport refund ───────────────────────────────────────────────────
// Called when a confirmed booking is cancelled after transport has been paid.
// transactionRef must come from transport_transaction_ref on the booking row.

export async function issueTransportRefund(
  bookingId: string,
  transactionRef: string,
): Promise<void> {
  if (!config.paystackSecretKey) {
    throw new TransportFareError('Paystack is not configured — transport refund cannot be issued.', 503);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  let response: globalThis.Response;
  try {
    response = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transaction: transactionRef }),
    });
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'AbortError') {
      throw new TransportFareError(
        `Transport refund timed out for booking ${bookingId}. Issue manually via Paystack dashboard (tx: ${transactionRef}).`,
        504,
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const body = await response.json().catch(() => ({})) as { status?: boolean; message?: string };
  if (!response.ok || !body.status) {
    const msg = body.message ?? `HTTP ${response.status}`;
    console.error(
      `[transport-refund] Paystack refund FAILED for booking ${bookingId} (tx: ${transactionRef}): ${msg}. ` +
      `Issue manually via Paystack dashboard.`,
    );
    throw new TransportFareError(`Transport refund failed: ${msg}`, 502);
  }

  // Flip transport_status to 'refunded'. If this DB write fails the Paystack refund
  // was still issued — log clearly so the discrepancy can be reconciled manually.
  const { error: updateErr } = await supabase
    .from('bookings')
    .update({ transport_status: 'refunded' })
    .eq('id', bookingId);

  if (updateErr) {
    console.error(
      `[transport-refund] Refund issued on Paystack for booking ${bookingId} (tx: ${transactionRef}) ` +
      `but transport_status DB update failed: ${updateErr.message}. Manual reconciliation needed.`,
    );
    return;
  }

  console.log(`[transport-refund] Transport refund issued for booking ${bookingId} (tx: ${transactionRef})`);

  // transport_status just left 'paid', so any keeper's transport reimbursement
  // for this booking stops counting as owed (see getWalletSummary / the
  // keeper_request_withdrawal RPC, both gated on transport_status='paid'). A
  // keeper who already withdrew against it (withdrawals never flip
  // booking_cleaners.paid_out — see 20260704000003_keeper_withdrawal_fn.sql)
  // can now show a negative wallet; flag it for admin the same way a
  // cleaning-fee refund does.
  const { data: keepers } = await supabase
    .from('booking_cleaners')
    .select('cleaner_id')
    .eq('booking_id', bookingId)
    .gt('transport_fare_kobo', 0);

  for (const cleanerId of new Set(((keepers ?? []) as { cleaner_id: string }[]).map((k) => k.cleaner_id))) {
    await flagIfWalletNegative(cleanerId, `a transport refund on booking ${bookingId}`);
  }
}

// ─── Reset transport fare ─────────────────────────────────────────────────────
// Cancels an existing Paystack Payment Request (if one was sent) and resets the
// booking back to pending_quote so the admin can re-quote with a corrected fare.
// Only valid when transport_status is 'awaiting_payment' — not after it is paid.

export interface ResetTransportFareResult {
  booking_id: string;
  prq_cancelled: boolean;
  transport_status: string;
}

export async function resetTransportFare(bookingId: string): Promise<ResetTransportFareResult> {
  const { data: booking, error: fetchErr } = await supabase
    .from('bookings')
    .select('id, status, transport_status, transport_payment_ref')
    .eq('id', bookingId)
    .single();

  if (fetchErr || !booking) {
    throw new TransportFareError(`Booking ${bookingId} not found.`, 404);
  }
  if (booking.status !== 'confirmed') {
    throw new TransportFareError(
      `Can only reset transport fare on a confirmed booking. This booking is "${booking.status as string}".`,
      409,
    );
  }
  if (booking.transport_status === 'paid') {
    throw new TransportFareError(
      'Cannot reset a fare that has already been paid. Cancel the booking to issue a refund.',
      409,
    );
  }
  if (booking.transport_status !== 'awaiting_payment') {
    throw new TransportFareError(
      `Transport fare can only be reset when status is "awaiting_payment". Current: "${booking.transport_status as string}".`,
      409,
    );
  }

  // Cancel the existing Payment Request on Paystack if one was already sent.
  // Non-fatal: the PRQ may have already expired or been cancelled; log and continue.
  let prq_cancelled = false;
  const prqCode = booking.transport_payment_ref as string | null;
  if (prqCode) {
    try {
      await paystackPost(`/paymentrequest/cancel/${prqCode}`);
      prq_cancelled = true;
      console.log(`[transport-reset] Cancelled PRQ ${prqCode} on Paystack for booking ${bookingId}`);
    } catch (err) {
      console.warn(
        `[transport-reset] Could not cancel PRQ ${prqCode} on Paystack for booking ${bookingId} ` +
        `(may already be cancelled/expired): ${(err as Error).message}`,
      );
    }
  }

  // Reset all fare fields so the admin can start a fresh quote.
  const { data: updated, error: updateErr } = await supabase
    .from('bookings')
    .update({
      transport_status:        'pending_quote',
      transport_fare:          null,
      transport_payment_ref:   null,
      transport_awaiting_since: null,
    })
    .eq('id', bookingId)
    .select('id, transport_status')
    .single();

  if (updateErr || !updated) {
    throw updateErr ?? new Error('Failed to reset transport fare fields.');
  }

  console.log(
    `[transport-reset] Booking ${bookingId} reset to pending_quote ` +
    `(PRQ cancelled on Paystack: ${prq_cancelled})`,
  );

  return {
    booking_id:       bookingId,
    prq_cancelled,
    transport_status: updated.transport_status as string,
  };
}
