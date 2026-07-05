import { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config';
import { supabase } from '../lib/supabase';
import {
  notifyAdminPaidBooking,
  notifyCleanerNewJob,
  notifyCleanerNewJobEmail,
} from '../services/notificationService';
import { handleTransferWebhook } from '../services/payoutService';
import { adjustEarningForRefund } from '../services/earningsService';
import { issueRefund } from '../services/refundService';
import { handleTransportInvoicePaid } from '../services/transportInvoiceService';

// ─── Signature verification ───────────────────────────────────────────────────

function verifySignature(rawBody: Buffer, signature: string): boolean {
  if (!config.paystackSecretKey) return false;
  const expected = createHmac('sha512', config.paystackSecretKey)
    .update(rawBody)
    .digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature.toLowerCase(), 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ─── Paystack event types ─────────────────────────────────────────────────────

interface PaystackChargeSuccess {
  event: 'charge.success';
  data: {
    reference: string;
    status: string;
    amount: number;
    customer: { email: string };
  };
}

interface PaystackTransferEvent {
  event: 'transfer.success' | 'transfer.failed' | 'transfer.reversed';
  data: {
    reference: string;
    transfer_code: string;
    status: string;
    reason?: string;
  };
}

interface PaystackRefundEvent {
  event: 'refund.processed';
  data: {
    amount: number;               // refund amount in kobo
    transaction_reference: string; // original charge reference
    status: string;
  };
}

interface PaystackInvoicePaidEvent {
  event: 'invoice.payment_successful';
  data: {
    request_code: string;  // PRQ_xxxx, matches transport_payment_ref
    paid: boolean;
    paid_at: string;
    amount: number;        // kobo
    // Paystack includes the settled transaction(s) in the webhook payload.
    // We capture the first reference so we can issue a refund later if needed.
    transactions?: Array<{ reference: string }>;
  };
}

interface PaystackEvent {
  event: string;
  data: Record<string, unknown>;
}

// ─── Webhook handler ──────────────────────────────────────────────────────────

export async function postPaystackWebhook(req: Request, res: Response): Promise<void> {
  const rawBody = req.body as Buffer;
  const signature = (req.headers['x-paystack-signature'] as string | undefined) ?? '';

  if (!verifySignature(rawBody, signature)) {
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  let payload: PaystackEvent;
  try {
    payload = JSON.parse(rawBody.toString('utf8')) as PaystackEvent;
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  if (payload.event === 'charge.success') {
    const event = payload as unknown as PaystackChargeSuccess;
    const { reference } = event.data;
    if (!reference) { res.sendStatus(200); return; }
    try {
      await processChargeSuccess(reference);
      res.sendStatus(200);
    } catch (err) {
      console.error('[webhook] Unhandled processing error:', err);
      res.sendStatus(500);
    }
    return;
  }

  if (['transfer.success', 'transfer.failed', 'transfer.reversed'].includes(payload.event)) {
    const event = payload as unknown as PaystackTransferEvent;
    try {
      await handleTransferWebhook(event.event as PaystackTransferEvent['event'], event.data);
      res.sendStatus(200);
    } catch (err) {
      console.error('[webhook] Transfer event error:', err);
      res.sendStatus(500);
    }
    return;
  }

  if (payload.event === 'refund.processed') {
    const event = payload as unknown as PaystackRefundEvent;
    try {
      await processRefundProcessed(event.data.transaction_reference, event.data.amount);
      res.sendStatus(200);
    } catch (err) {
      console.error('[webhook] Refund event error:', err);
      res.sendStatus(500);
    }
    return;
  }

  if (payload.event === 'invoice.payment_successful') {
    const event = payload as unknown as PaystackInvoicePaidEvent;
    const { request_code, transactions } = event.data;
    // Paystack includes the settling transaction(s) in the payload. Capture the
    // first reference so we can issue a refund later if the booking is cancelled.
    const txRef = transactions?.[0]?.reference ?? null;
    if (request_code) {
      try {
        await handleTransportInvoicePaid(request_code, txRef);
      } catch (err) {
        console.error('[webhook] invoice.payment_successful error:', err);
        res.sendStatus(500);
        return;
      }
    }
    res.sendStatus(200);
    return;
  }

  // All other events: acknowledge and ignore
  res.sendStatus(200);
}

// ─── Core processing ──────────────────────────────────────────────────────────

async function processRefundProcessed(transactionRef: string, refundKobo: number): Promise<void> {
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, total_amount_kobo, refund_kobo')
    .eq('paystack_reference', transactionRef)
    .maybeSingle();

  if (!booking) {
    console.warn(`[webhook] No booking found for refund reference: ${transactionRef}`);
    return;
  }

  // Accumulate in case of multiple partial refunds, then cap at total
  const totalKobo      = booking.total_amount_kobo as number;
  const previousRefund = (booking.refund_kobo as number) ?? 0;
  const newRefundTotal = Math.min(totalKobo, previousRefund + refundKobo);

  await supabase
    .from('bookings')
    .update({
      refund_kobo:  newRefundTotal,
      refunded_at:  new Date().toISOString(),
    })
    .eq('id', booking.id as string);

  // Adjust or cancel cleaner earning (idempotent, safe if issueRefund already ran)
  await adjustEarningForRefund(booking.id as string, newRefundTotal, totalKobo);
}

async function processChargeSuccess(reference: string): Promise<void> {
  // Atomically confirm: flip matched → confirmed.
  // The cleaner was already assigned at booking creation, payment just confirms it.
  const { data: claimed, error: claimErr } = await supabase
    .from('bookings')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('paystack_reference', reference)
    .eq('status', 'matched')
    .select('id');

  if (claimErr) throw claimErr;

  if (!claimed || claimed.length === 0) {
    // No row claimed, check whether this is a duplicate delivery or something unexpected
    const { data: existing, error: lookupErr } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('paystack_reference', reference)
      .maybeSingle();

    if (lookupErr) throw lookupErr;

    if (!existing) {
      console.warn(`[webhook] No booking found for reference: ${reference}`);
      return;
    }

    if (existing.status === 'confirmed') {
      // Duplicate delivery, already processed, nothing to do
      return;
    }

    // Slot expired: the 25-min cron cancelled the booking but payment still landed.
    // Auto-refund so the customer is never charged for a booking that wasn't confirmed.
    if (existing.status === 'cancelled') {
      console.error(
        `[webhook] Booking ${existing.id as string} was slot-expired (cancelled) but charged, auto-refunding ref: ${reference}`,
      );
      await issueRefund(existing.id as string, reference);
      return;
    }

    // Any other status (no_match, pending_payment) is unexpected; log and ignore
    console.warn(`[webhook] Unexpected booking status "${existing.status as string}" for reference: ${reference}`);
    return;
  }

  const bookingId = claimed[0].id as string;

  // Notify admin and cleaner on payment confirmation.
  // Customer notification fires later from the admin panel when dispatch is confirmed.
  await notifyAdminPaidBooking(bookingId);
  await notifyCleanerNewJob(bookingId);
  await notifyCleanerNewJobEmail(bookingId);
}
