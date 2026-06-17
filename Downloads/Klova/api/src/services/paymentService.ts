import { supabase } from '../lib/supabase';
import { config } from '../config';

export interface PaymentInitResult {
  authorization_url: string;
  reference: string;
}

export class PaymentError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'PaymentError';
    this.status = status;
  }
}

interface PaystackInitResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    reference: string;
    access_code: string;
  };
}

export async function initializePayment(bookingId: string): Promise<PaymentInitResult> {
  if (!config.paystackSecretKey) {
    throw new PaymentError('Payment provider is not configured.', 503);
  }

  // Load booking + customer email via foreign-key join
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('id, status, total_amount_kobo, customers(email)')
    .eq('id', bookingId)
    .single();

  if (bookingErr || !booking) {
    throw new PaymentError('Booking not found.', 404);
  }
  if (booking.status !== 'pending_payment') {
    throw new PaymentError('Booking is not awaiting payment.', 400);
  }

  // Supabase returns the joined row as a nested object (many-to-one FK)
  const customerData = booking.customers as unknown as { email: string } | null;
  if (!customerData?.email) {
    throw new PaymentError('Customer email is required for payment.', 400);
  }

  // Call Paystack — amount is already in kobo, which is what Paystack expects for NGN
  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.paystackSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: customerData.email,
      amount: booking.total_amount_kobo,
    }),
  });

  if (!paystackRes.ok) {
    const body = await paystackRes.json().catch(() => ({})) as { message?: string };
    throw new PaymentError(body.message ?? 'Paystack returned an error.', 502);
  }

  const payload = await paystackRes.json() as PaystackInitResponse;

  if (!payload.status) {
    throw new PaymentError(payload.message ?? 'Paystack initialization failed.', 502);
  }

  const { authorization_url, reference } = payload.data;

  // Persist the reference on the booking so the webhook can look it up
  const { error: updateErr } = await supabase
    .from('bookings')
    .update({ paystack_reference: reference })
    .eq('id', bookingId);

  if (updateErr) throw updateErr;

  return { authorization_url, reference };
}
