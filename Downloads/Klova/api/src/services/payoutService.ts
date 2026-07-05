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

// ─── Transfer webhook handler ─────────────────────────────────────────────────

/**
 * Called from the Paystack webhook handler for transfer events. Finalizes
 * BOTH payout paths that share the cleaner_payouts table:
 *  - admin batch payouts (requested_by='admin') — a retired path (no route
 *    creates these anymore; the admin portal now only shows keepers their own
 *    self-service withdrawals), kept here purely so any pre-existing
 *    pending/processing admin payout row still settles correctly. Those rows
 *    pre-link specific cleaner_earnings/booking_cleaners rows via
 *    payout_id/transport_payout_id before the transfer is sent, so settlement
 *    here means flipping those linked rows to their paid state.
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
