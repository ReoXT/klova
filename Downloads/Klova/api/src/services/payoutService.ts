import { supabase } from '../lib/supabase';
import { config } from '../config';

const PAYSTACK_BASE = 'https://api.paystack.co';

// ─── Paystack API helpers ─────────────────────────────────────────────────────

async function paystackPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.paystackSecretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { status: boolean; message: string; data: T };
  if (!res.ok || !json.status) {
    throw new Error(`Paystack ${path} failed: ${json.message ?? res.statusText}`);
  }
  return json.data;
}

// ─── Ensure recipient ─────────────────────────────────────────────────────────

/**
 * Creates a Paystack Transfer Recipient if one doesn't already exist.
 * Idempotent — safe to call on every payout.
 */
export async function ensurePaystackRecipient(bankAccountId: string): Promise<string> {
  const { data: ba, error } = await supabase
    .from('cleaner_bank_accounts')
    .select('id, account_name, account_number, bank_code, paystack_recipient_code')
    .eq('id', bankAccountId)
    .single();

  if (error || !ba) throw error ?? new Error(`Bank account ${bankAccountId} not found`);

  if (ba.paystack_recipient_code) return ba.paystack_recipient_code as string;

  const result = await paystackPost<{ recipient_code: string }>('/transferrecipient', {
    type:           'nuban',
    name:           ba.account_name,
    account_number: ba.account_number,
    bank_code:      ba.bank_code,
    currency:       'NGN',
  });

  await supabase
    .from('cleaner_bank_accounts')
    .update({ paystack_recipient_code: result.recipient_code })
    .eq('id', bankAccountId);

  return result.recipient_code;
}

// ─── Initiate bulk payout ─────────────────────────────────────────────────────

interface BulkTransferItem {
  amount: number;
  reference: string;
  reason: string;
  recipient: string;
}

interface BulkTransferResultItem {
  reference: string;
  transfer_code?: string;
  status: string;
}

/**
 * Initiates Paystack bulk transfers for a list of cleaners.
 *
 * Each cleaner gets a single transfer for:
 *   unpaid cleaning earnings  (cleaner_earnings WHERE status='unpaid')
 * + settled transport fares   (booking_cleaners WHERE paid_out=false
 *                              AND transport_payout_id IS NULL
 *                              AND transport_fare_kobo > 0
 *                              AND booking.transport_status='paid')
 *
 * After creating the payout row, marks earnings as 'scheduled' and links
 * booking_cleaners rows via transport_payout_id so failures can be reversed.
 *
 * If Paystack Transfers is not yet activated on your dashboard, Paystack will
 * return an error — the cleaner_payouts rows will NOT be created.
 * Use markPaidManually() as a fallback until Transfers is activated.
 */
export async function initiateBulkPayout(
  cleanerIds: string[],
): Promise<{ success: string[]; failed: { cleaner_id: string; reason: string }[] }> {
  const results = { success: [] as string[], failed: [] as { cleaner_id: string; reason: string }[] };

  for (const cleanerId of cleanerIds) {
    try {
      // 1. Gather unpaid cleaning earnings
      const { data: earnings, error: eErr } = await supabase
        .from('cleaner_earnings')
        .select('id, earning_kobo')
        .eq('cleaner_id', cleanerId)
        .eq('status', 'unpaid');

      if (eErr) throw eErr;

      const earningsKobo = ((earnings ?? []) as { id: string; earning_kobo: number }[])
        .reduce((sum, e) => sum + e.earning_kobo, 0);

      // 2. Gather eligible transport reimbursements for this keeper
      const { data: transportRows, error: trErr } = await supabase
        .from('booking_cleaners')
        .select('id, transport_fare_kobo, booking_id')
        .eq('cleaner_id', cleanerId)
        .eq('paid_out', false)
        .is('transport_payout_id', null)
        .gt('transport_fare_kobo', 0);

      if (trErr) throw trErr;

      let transportKobo = 0;
      const eligibleTransportIds: string[] = [];

      if (transportRows && transportRows.length > 0) {
        const bookingIds = transportRows.map((r) => r.booking_id as string);
        const { data: paidBookings, error: pbErr } = await supabase
          .from('bookings')
          .select('id')
          .in('id', bookingIds)
          .eq('transport_status', 'paid');

        if (pbErr) throw pbErr;

        const paidIds = new Set((paidBookings ?? []).map((b) => b.id as string));
        for (const row of transportRows) {
          if (!paidIds.has(row.booking_id as string)) continue;
          transportKobo += row.transport_fare_kobo as number;
          eligibleTransportIds.push(row.id as string);
        }
      }

      const totalKobo = earningsKobo + transportKobo;
      if (totalKobo === 0) continue; // nothing to pay

      // 3. Get primary bank account
      const { data: ba, error: baErr } = await supabase
        .from('cleaner_bank_accounts')
        .select('id')
        .eq('cleaner_id', cleanerId)
        .eq('is_primary', true)
        .single();

      if (baErr || !ba) throw new Error('No primary bank account on file');

      // 4. Ensure Paystack recipient exists
      const recipientCode = await ensurePaystackRecipient(ba.id as string);

      // 5. Generate reference
      const reference = `klova-payout-${cleanerId.slice(0, 8)}-${Date.now()}`;

      // 6. Create cleaner_payouts row (pending)
      const { data: payout, error: pErr } = await supabase
        .from('cleaner_payouts')
        .insert({
          cleaner_id:      cleanerId,
          bank_account_id: ba.id,
          total_kobo:      totalKobo,
          method:          'paystack',
          status:          'pending',
          paystack_transfer_reference: reference,
          initiated_at:    new Date().toISOString(),
        })
        .select('id')
        .single();

      if (pErr || !payout) throw pErr ?? new Error('Failed to create payout row');

      // 7. Send Paystack single transfer (bulk endpoint for future batching)
      const transfers: BulkTransferItem[] = [{
        amount:    totalKobo,
        reference,
        reason:    `Klova cleaner earnings payout`,
        recipient: recipientCode,
      }];

      const transferResults = await paystackPost<BulkTransferResultItem[]>('/transfer/bulk', {
        currency:   'NGN',
        source:     'balance',
        transfers,
      });

      const tr = transferResults[0];

      // 8. Update payout to processing
      await supabase
        .from('cleaner_payouts')
        .update({
          status:                 'processing',
          paystack_transfer_code: tr.transfer_code ?? null,
        })
        .eq('id', payout.id);

      // 9. Mark cleaning earnings as scheduled
      if ((earnings ?? []).length > 0) {
        await supabase
          .from('cleaner_earnings')
          .update({ status: 'scheduled', payout_id: payout.id })
          .eq('cleaner_id', cleanerId)
          .eq('status', 'unpaid');
      }

      // 10. Link transport rows to this payout (in-flight; revertible on failure)
      if (eligibleTransportIds.length > 0) {
        await supabase
          .from('booking_cleaners')
          .update({ transport_payout_id: payout.id })
          .in('id', eligibleTransportIds);
      }

      results.success.push(cleanerId);
    } catch (err) {
      results.failed.push({
        cleaner_id: cleanerId,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

// ─── Manual fallback ──────────────────────────────────────────────────────────

/**
 * Marks a cleaner's unpaid earnings and settled transport fares as paid
 * without going through Paystack.
 * Admin has manually transferred via their bank — this keeps the ledger accurate.
 */
export async function markPaidManually(
  cleanerId: string,
  bankAccountId: string,
): Promise<{ payout_id: string; total_kobo: number }> {
  // 1. Gather unpaid cleaning earnings
  const { data: earnings, error: eErr } = await supabase
    .from('cleaner_earnings')
    .select('id, earning_kobo')
    .eq('cleaner_id', cleanerId)
    .eq('status', 'unpaid');

  if (eErr) throw eErr;

  const earningsKobo = ((earnings ?? []) as { id: string; earning_kobo: number }[])
    .reduce((sum, e) => sum + e.earning_kobo, 0);

  // 2. Gather eligible transport reimbursements
  const { data: transportRows, error: trErr } = await supabase
    .from('booking_cleaners')
    .select('id, transport_fare_kobo, booking_id')
    .eq('cleaner_id', cleanerId)
    .eq('paid_out', false)
    .is('transport_payout_id', null)
    .gt('transport_fare_kobo', 0);

  if (trErr) throw trErr;

  let transportKobo = 0;
  const eligibleTransportIds: string[] = [];

  if (transportRows && transportRows.length > 0) {
    const bookingIds = transportRows.map((r) => r.booking_id as string);
    const { data: paidBookings, error: pbErr } = await supabase
      .from('bookings')
      .select('id')
      .in('id', bookingIds)
      .eq('transport_status', 'paid');

    if (pbErr) throw pbErr;

    const paidIds = new Set((paidBookings ?? []).map((b) => b.id as string));
    for (const row of transportRows) {
      if (!paidIds.has(row.booking_id as string)) continue;
      transportKobo += row.transport_fare_kobo as number;
      eligibleTransportIds.push(row.id as string);
    }
  }

  const totalKobo = earningsKobo + transportKobo;
  if (totalKobo === 0) throw new Error('No unpaid earnings or transport fares for this cleaner');

  const now = new Date().toISOString();

  // 3. Create payout row (already success — no Paystack in the loop)
  const { data: payout, error: pErr } = await supabase
    .from('cleaner_payouts')
    .insert({
      cleaner_id:      cleanerId,
      bank_account_id: bankAccountId,
      total_kobo:      totalKobo,
      method:          'manual',
      status:          'success',
      initiated_at:    now,
      completed_at:    now,
    })
    .select('id')
    .single();

  if (pErr || !payout) throw pErr ?? new Error('Failed to create payout row');

  // 4. Settle cleaning earnings
  if ((earnings ?? []).length > 0) {
    await supabase
      .from('cleaner_earnings')
      .update({ status: 'paid', payout_id: payout.id })
      .eq('cleaner_id', cleanerId)
      .eq('status', 'unpaid');
  }

  // 5. Settle transport reimbursements
  if (eligibleTransportIds.length > 0) {
    await supabase
      .from('booking_cleaners')
      .update({ paid_out: true, transport_payout_id: payout.id })
      .in('id', eligibleTransportIds);
  }

  return { payout_id: payout.id as string, total_kobo: totalKobo };
}

// ─── Transfer webhook handler ─────────────────────────────────────────────────

/**
 * Called from the Paystack webhook handler for transfer events. Finalizes
 * BOTH payout paths that share the cleaner_payouts table:
 *  - admin batch payouts (requested_by='admin') — pre-link specific
 *    cleaner_earnings/booking_cleaners rows via payout_id/transport_payout_id
 *    before the transfer is sent (see initiateBulkPayout above), so
 *    settlement here means flipping those linked rows to their paid state.
 *  - keeper self-service withdrawals (requested_by='keeper',
 *    keeper_request_withdrawal in 20260704000003_keeper_withdrawal_fn.sql) —
 *    an arbitrary amount reserved against a running total, with NO linked
 *    earnings/booking_cleaners rows to flip. cleaner_payouts.status is the
 *    sole source of truth for what's been withdrawn: both
 *    keeper_request_withdrawal's v_withdrawn and getWalletSummary's
 *    withdrawn_or_pending_kobo (web/app/api/keeper/_wallet.ts) sum only
 *    payouts NOT IN ('failed','reversed'), so flipping status on
 *    failure/reversal is the entire "return funds to available" effect —
 *    no separate credit-back step exists or is needed.
 */
export async function handleTransferWebhook(
  event: 'transfer.success' | 'transfer.failed' | 'transfer.reversed',
  data: { reference: string; transfer_code?: string; status?: string; reason?: string },
): Promise<void> {
  const { reference } = data;
  if (!reference) return;

  const { data: payout, error } = await supabase
    .from('cleaner_payouts')
    .select('id, status, requested_by')
    .eq('paystack_transfer_reference', reference)
    .maybeSingle();

  if (error) throw error;
  if (!payout) {
    console.warn(`[webhook] No payout found for transfer reference: ${reference}`);
    return;
  }

  const payoutId = payout.id as string;
  const currentStatus = payout.status as string;
  const isKeeperWithdrawal = payout.requested_by === 'keeper';

  // Idempotency / delivery-order guard. Paystack delivers webhooks at-least
  // once with no ordering guarantee, so a payout may already be terminal by
  // the time this event arrives:
  //  - failed/reversed are always final — ignore anything after them.
  //  - success is final EXCEPT a genuine later transfer.reversed (Paystack
  //    can reverse an already-successful transfer, e.g. a bank-side issue
  //    found after settlement) — that's a real transition, not a duplicate.
  //  - a transfer.failed arriving after success would mean downgrading a
  //    transfer that already paid out — never apply it; a late/out-of-order
  //    delivery must not corrupt an already-settled ledger.
  if (currentStatus === 'failed' || currentStatus === 'reversed') return;
  if (currentStatus === 'success' && event !== 'transfer.reversed') return;

  if (event === 'transfer.success') {
    await supabase
      .from('cleaner_payouts')
      .update({ status: 'success', completed_at: new Date().toISOString() })
      .eq('id', payoutId);

    if (!isKeeperWithdrawal) {
      // Finalize cleaning earnings
      await supabase
        .from('cleaner_earnings')
        .update({ status: 'paid' })
        .eq('payout_id', payoutId);

      // Finalize transport reimbursements linked to this payout
      await supabase
        .from('booking_cleaners')
        .update({ paid_out: true })
        .eq('transport_payout_id', payoutId);
    }

  } else {
    const newStatus = event === 'transfer.reversed' ? 'reversed' : 'failed';
    await supabase
      .from('cleaner_payouts')
      .update({ status: newStatus, failure_reason: data.reason ?? event })
      .eq('id', payoutId);

    if (!isKeeperWithdrawal) {
      // Revert cleaning earnings so they are re-queued next payout run
      await supabase
        .from('cleaner_earnings')
        .update({ status: 'failed' })
        .eq('payout_id', payoutId)
        .eq('status', 'scheduled');

      // Revert transport links so they are re-queued next payout run
      await supabase
        .from('booking_cleaners')
        .update({ transport_payout_id: null })
        .eq('transport_payout_id', payoutId);
    }

    console.warn(`[payout] Transfer ${event} for reference ${reference}: ${data.reason ?? '—'}`);
  }
}
