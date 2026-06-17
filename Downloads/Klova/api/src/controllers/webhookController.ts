import { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config';
import { supabase } from '../lib/supabase';
import { assignCleaner } from '../services/assignmentService';
import {
  notifyCustomerAssigned,
  notifyAdminAssigned,
  notifyAdminNoMatch,
} from '../services/notificationService';

// ─── Signature verification ───────────────────────────────────────────────────

function verifySignature(rawBody: Buffer, signature: string): boolean {
  if (!config.paystackSecretKey) return false;
  const expected = createHmac('sha512', config.paystackSecretKey)
    .update(rawBody)
    .digest('hex');
  // timingSafeEqual requires equal-length buffers
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

  // Only handle charge.success — return 200 for anything else so Paystack stops retrying
  if (payload.event !== 'charge.success') {
    res.sendStatus(200);
    return;
  }

  const event = payload as unknown as PaystackChargeSuccess;
  const { reference } = event.data;

  if (!reference) {
    res.sendStatus(200);
    return;
  }

  try {
    await processChargeSuccess(reference);
    res.sendStatus(200);
  } catch (err) {
    // Return 500 so Paystack retries — only fires on unexpected DB/system errors
    console.error('[webhook] Unhandled processing error:', err);
    res.sendStatus(500);
  }
}

// ─── Core processing (separated for testability) ─────────────────────────────

async function processChargeSuccess(reference: string): Promise<void> {
  // Atomically claim: flip pending_payment → paid.
  // Only one webhook delivery wins this race — the other gets an empty result.
  const { data: claimed, error: claimErr } = await supabase
    .from('bookings')
    .update({ status: 'paid' })
    .eq('paystack_reference', reference)
    .eq('status', 'pending_payment')
    .select('id, zone_id, customer_id, booking_date, requested_cleaner_id');

  if (claimErr) throw claimErr;

  let booking = claimed?.[0] ?? null;

  if (!booking) {
    // Claim returned 0 rows — check for idempotency / retry cases
    const { data: existing, error: lookupErr } = await supabase
      .from('bookings')
      .select('id, status, zone_id, customer_id, booking_date, requested_cleaner_id')
      .eq('paystack_reference', reference)
      .maybeSingle();

    if (lookupErr) throw lookupErr;

    if (!existing) {
      // No booking with this reference — log and ignore
      console.warn(`[webhook] No booking found for reference: ${reference}`);
      return;
    }

    if (existing.status === 'matched' || existing.status === 'no_match') {
      // Already fully processed — idempotent exit
      return;
    }

    if (existing.status === 'paid') {
      // Previous webhook claimed payment but assignment failed — retry assignment
      booking = existing;
    } else {
      // Unexpected status (cancelled, confirmed, etc.) — ignore
      return;
    }
  }

  // Run matching + concurrency-safe assignment
  const result = await assignCleaner(
    booking.id,
    {
      zone_id: booking.zone_id,
      customer_id: booking.customer_id,
      booking_date: booking.booking_date,
      requested_cleaner_id: booking.requested_cleaner_id ?? null,
    },
    reference,
  );

  // Notify (stubs until Section 5)
  if (result === 'matched') {
    await notifyCustomerAssigned(booking.id);
    await notifyAdminAssigned(booking.id);
  } else {
    await notifyAdminNoMatch(booking.id);
  }
}
