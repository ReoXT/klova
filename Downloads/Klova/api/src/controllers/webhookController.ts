import { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config';
import { supabase } from '../lib/supabase';
import {
  notifyAdminPaidBooking,
  notifyCleanerNewJob,
} from '../services/notificationService';
import { handleTransferWebhook } from '../services/payoutService';

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

  // All other events — acknowledge and ignore
  res.sendStatus(200);
}

// ─── Core processing ──────────────────────────────────────────────────────────

async function processChargeSuccess(reference: string): Promise<void> {
  // Atomically confirm: flip matched → confirmed.
  // The cleaner was already assigned at booking creation — payment just confirms it.
  const { data: claimed, error: claimErr } = await supabase
    .from('bookings')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('paystack_reference', reference)
    .eq('status', 'matched')
    .select('id');

  if (claimErr) throw claimErr;

  if (!claimed || claimed.length === 0) {
    // No row claimed — check whether this is a duplicate delivery or something unexpected
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
      // Duplicate delivery — already processed, nothing to do
      return;
    }

    // Any other status (no_match, cancelled, pending_payment) — ignore
    console.warn(`[webhook] Unexpected booking status "${existing.status}" for reference: ${reference}`);
    return;
  }

  const bookingId = claimed[0].id as string;

  // Notify admin and cleaner on payment confirmation.
  // Customer notification fires later from the admin panel when dispatch is confirmed.
  await notifyAdminPaidBooking(bookingId);
  await notifyCleanerNewJob(bookingId);
}
