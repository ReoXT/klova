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
 * Each cleaner gets a single transfer for the sum of their unpaid earnings.
 * Inserts cleaner_payouts rows and marks earnings as 'scheduled'.
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
      // 1. Gather unpaid earnings
      const { data: earnings, error: eErr } = await supabase
        .from('cleaner_earnings')
        .select('id, earning_kobo')
        .eq('cleaner_id', cleanerId)
        .eq('status', 'unpaid');

      if (eErr) throw eErr;
      if (!earnings || earnings.length === 0) continue;

      const totalKobo = (earnings as { id: string; earning_kobo: number }[])
        .reduce((sum, e) => sum + e.earning_kobo, 0);

      // 2. Get primary bank account
      const { data: ba, error: baErr } = await supabase
        .from('cleaner_bank_accounts')
        .select('id')
        .eq('cleaner_id', cleanerId)
        .eq('is_primary', true)
        .single();

      if (baErr || !ba) throw new Error('No primary bank account on file');

      // 3. Ensure Paystack recipient exists
      const recipientCode = await ensurePaystackRecipient(ba.id as string);

      // 4. Generate reference
      const reference = `klova-payout-${cleanerId.slice(0, 8)}-${Date.now()}`;

      // 5. Create cleaner_payouts row (pending)
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

      // 6. Send Paystack single transfer (use bulk endpoint so it can be batched later)
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

      // 7. Update payout to processing
      await supabase
        .from('cleaner_payouts')
        .update({
          status:                 'processing',
          paystack_transfer_code: tr.transfer_code ?? null,
        })
        .eq('id', payout.id);

      // 8. Mark earnings as scheduled
      await supabase
        .from('cleaner_earnings')
        .update({ status: 'scheduled', payout_id: payout.id })
        .eq('cleaner_id', cleanerId)
        .eq('status', 'unpaid');

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
 * Marks a cleaner's unpaid earnings as paid without going through Paystack.
 * Admin has manually transferred via their bank — this keeps the ledger accurate.
 */
export async function markPaidManually(cleanerId: string, bankAccountId: string): Promise<{ payout_id: string; total_kobo: number }> {
  const { data: earnings, error: eErr } = await supabase
    .from('cleaner_earnings')
    .select('id, earning_kobo')
    .eq('cleaner_id', cleanerId)
    .eq('status', 'unpaid');

  if (eErr) throw eErr;
  if (!earnings || earnings.length === 0) {
    throw new Error('No unpaid earnings for this cleaner');
  }

  const totalKobo = (earnings as { id: string; earning_kobo: number }[])
    .reduce((sum, e) => sum + e.earning_kobo, 0);

  const now = new Date().toISOString();

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

  await supabase
    .from('cleaner_earnings')
    .update({ status: 'paid', payout_id: payout.id })
    .eq('cleaner_id', cleanerId)
    .eq('status', 'unpaid');

  return { payout_id: payout.id as string, total_kobo: totalKobo };
}

// ─── Transfer webhook handler ─────────────────────────────────────────────────

/**
 * Called from the Paystack webhook handler for transfer events.
 */
export async function handleTransferWebhook(
  event: 'transfer.success' | 'transfer.failed' | 'transfer.reversed',
  data: { reference: string; transfer_code?: string; status?: string; reason?: string },
): Promise<void> {
  const { reference } = data;
  if (!reference) return;

  const { data: payout, error } = await supabase
    .from('cleaner_payouts')
    .select('id, status')
    .eq('paystack_transfer_reference', reference)
    .maybeSingle();

  if (error) throw error;
  if (!payout) {
    console.warn(`[webhook] No payout found for transfer reference: ${reference}`);
    return;
  }

  if (payout.status === 'success') return; // duplicate delivery

  const payoutId = payout.id as string;

  if (event === 'transfer.success') {
    await supabase
      .from('cleaner_payouts')
      .update({ status: 'success', completed_at: new Date().toISOString() })
      .eq('id', payoutId);

    await supabase
      .from('cleaner_earnings')
      .update({ status: 'paid' })
      .eq('payout_id', payoutId);

  } else {
    const newStatus = event === 'transfer.reversed' ? 'reversed' : 'failed';
    await supabase
      .from('cleaner_payouts')
      .update({ status: newStatus, failure_reason: data.reason ?? event })
      .eq('id', payoutId);

    await supabase
      .from('cleaner_earnings')
      .update({ status: 'failed' })
      .eq('payout_id', payoutId)
      .eq('status', 'scheduled');

    console.warn(`[payout] Transfer ${event} for reference ${reference}: ${data.reason ?? '—'}`);
  }
}
