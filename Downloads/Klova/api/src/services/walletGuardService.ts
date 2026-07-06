import { supabase } from '../lib/supabase';

/**
 * Detects a keeper wallet gone negative and logs a loud, greppable flag for
 * admin follow-up. This is a diagnostic-only check — it never mutates the
 * ledger and never throws, so a query failure here can't take down the
 * refund/cancellation flow that triggered it.
 *
 * Why a wallet can legitimately go negative: a keeper withdrawal reserves
 * against 'unpaid' cleaner_earnings / eligible booking_cleaners rows but
 * deliberately never flips them (see keeper_request_withdrawal.sql and
 * web/app/api/keeper/_wallet.ts). If a refund or transport-refund later
 * shrinks or zeroes one of those rows, the earlier withdrawal is still on
 * the books in cleaner_payouts, so the formula below can go below zero. The
 * withdrawal RPC's own balance check already blocks any further withdrawal
 * while available_kobo <= 0 — this function exists purely to surface that
 * state to a human instead of it sitting silent until someone happens to
 * look at the admin oversight screen.
 *
 * Mirrors getWalletSummary's formula (web/app/api/keeper/_wallet.ts)
 * verbatim. Duplicated here because api/ and web/ are separately deployed
 * apps sharing one Postgres database — the same tradeoff already made by
 * keeper_request_withdrawal.sql for the same reason.
 */
export async function flagIfWalletNegative(cleanerId: string, context: string): Promise<void> {
  try {
    const [earningsRes, transportRes, payoutsRes, adjustmentsRes] = await Promise.all([
      supabase.from('cleaner_earnings').select('earning_kobo, status').eq('cleaner_id', cleanerId),
      supabase
        .from('booking_cleaners')
        .select('transport_fare_kobo, booking:bookings!inner(transport_status)')
        .eq('cleaner_id', cleanerId)
        .eq('paid_out', false)
        .is('transport_payout_id', null)
        .gt('transport_fare_kobo', 0)
        .eq('booking.transport_status', 'paid'),
      supabase
        .from('cleaner_payouts')
        .select('amount_kobo, total_kobo, status')
        .eq('cleaner_id', cleanerId)
        .eq('requested_by', 'keeper'),
      supabase.from('cleaner_wallet_adjustments').select('amount_kobo').eq('cleaner_id', cleanerId),
    ]);

    if (earningsRes.error) throw earningsRes.error;
    if (transportRes.error) throw transportRes.error;
    if (payoutsRes.error) throw payoutsRes.error;
    if (adjustmentsRes.error) throw adjustmentsRes.error;

    const owedEarningsKobo = ((earningsRes.data ?? []) as { earning_kobo: number; status: string }[])
      .filter((e) => e.status === 'unpaid')
      .reduce((s, e) => s + e.earning_kobo, 0);

    const owedTransportKobo = ((transportRes.data ?? []) as { transport_fare_kobo: number | null }[])
      .reduce((s, r) => s + (r.transport_fare_kobo ?? 0), 0);

    const withdrawnKobo = (
      (payoutsRes.data ?? []) as { amount_kobo: number | null; total_kobo: number; status: string }[]
    )
      .filter((p) => p.status !== 'failed' && p.status !== 'reversed')
      .reduce((s, p) => s + (p.amount_kobo ?? p.total_kobo), 0);

    const adjustmentsKobo = ((adjustmentsRes.data ?? []) as { amount_kobo: number }[])
      .reduce((s, a) => s + a.amount_kobo, 0);

    const availableKobo = owedEarningsKobo + owedTransportKobo - withdrawnKobo + adjustmentsKobo;

    if (availableKobo < 0) {
      console.error(
        `[wallet-negative] cleaner ${cleanerId} available balance is ₦${(availableKobo / 100).toFixed(2)} ` +
        `(negative) after ${context}. This keeper likely already withdrew against an earning or transport ` +
        `reimbursement that has since been refunded. Further withdrawals are blocked automatically while ` +
        `negative (keeper_request_withdrawal RPC) — needs manual admin review on the payouts oversight screen.`,
      );
    }
  } catch (err) {
    console.error(`[wallet-negative] balance check itself failed for cleaner ${cleanerId} (context: ${context}):`, err);
  }
}
