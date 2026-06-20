import { supabase } from '../lib/supabase';
import { config } from '../config';
import { TransportFareError } from './transportFareService';

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
  // Use first 8 chars of booking UUID as a short human-readable reference
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
    // send_notification defaults to true — Paystack emails the customer automatically
    send_notification: true,
    metadata: {
      booking_id: bookingId,
      custom_fields: [
        { display_name: 'Booking ID', variable_name: 'booking_id', value: bookingId },
      ],
    },
  }) as PaystackInvoiceResponse;

  const { request_code, offline_reference } = payload.data;

  // Persist the reference so the webhook can tie the payment back to the booking
  const { data: updated, error: updateErr } = await supabase
    .from('bookings')
    .update({ transport_payment_ref: request_code })
    .eq('id', bookingId)
    .select('id, transport_fare, transport_status, transport_payment_ref')
    .single();

  if (updateErr || !updated) {
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

export async function handleTransportInvoicePaid(requestCode: string): Promise<void> {
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
    })
    .eq('id', booking.id as string);

  console.log(`[transport-invoice] PRQ ${requestCode} paid — booking ${booking.id as string} transport_status → paid`);
}
