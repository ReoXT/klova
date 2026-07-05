import type { SupabaseClient } from "@supabase/supabase-js";

export interface WalletSummary {
  // Cleaning earnings still owed to the keeper (cleaner_earnings status
  // 'unpaid'; excludes 'paid'/'scheduled'/'failed'/'refunded').
  owed_earnings_kobo: number;
  // Transport reimbursements still owed (booking_cleaners.paid_out=false)
  // where the customer has actually paid the transport invoice.
  owed_transport_kobo: number;
  // Keeper-initiated withdrawals that haven't failed — money already taken
  // out or in flight, subtracted from what's owed to get what's available.
  withdrawn_or_pending_kobo: number;
  // owed_earnings + owed_transport − withdrawn_or_pending.
  available_kobo: number;
  // Lifetime cleaning earnings ever credited (all non-refunded rows,
  // whether still owed or already paid). A display figure, not part of
  // the available-balance arithmetic.
  total_earned_kobo: number;
}

// Single source of truth for a keeper's wallet balance, derived entirely
// from the existing ledgers — no dedicated wallet/balance table.
//
// Keeper self-service withdrawal (keeper_request_withdrawal /
// POST /keeper/withdraw) is the ONLY payout path — the earlier admin
// batch-payout screen has been removed, so there is no second consumer of
// 'unpaid' cleaner_earnings / paid_out=false booking_cleaners rows to
// double-book against.
//
// available = owed − keeper-initiated non-failed withdrawals. The
// keeper-withdrawal write path deliberately leaves the underlying earnings
// 'unpaid' / transport paid_out=false for the entire life of a withdrawal —
// cleaner_payouts.status (NOT IN 'failed'/'reversed' == counted) is the sole
// record of what's been taken out; see handleTransferWebhook
// (api/src/services/payoutService.ts) for where that status is set.
export async function getWalletSummary(
  admin: SupabaseClient,
  cleanerId: string,
): Promise<WalletSummary> {
  // ── Cleaning earnings ────────────────────────────────────────────────────
  const { data: earnings, error: earnErr } = await admin
    .from("cleaner_earnings")
    .select("earning_kobo, status")
    .eq("cleaner_id", cleanerId);

  if (earnErr) throw earnErr;

  let owedEarningsKobo = 0;
  let totalEarnedKobo = 0;
  for (const e of (earnings ?? []) as { earning_kobo: number; status: string }[]) {
    if (e.status === "unpaid") owedEarningsKobo += e.earning_kobo;
    if (e.status !== "refunded") totalEarnedKobo += e.earning_kobo;
  }

  // ── Transport reimbursements ─────────────────────────────────────────────
  // Eligible: not yet paid out, not already linked to a payout in flight, a
  // positive fare, and the customer has actually paid the transport invoice
  // (transport_status = 'paid') so Klova is holding the money to reimburse.
  const { data: transportRows, error: trErr } = await admin
    .from("booking_cleaners")
    .select("transport_fare_kobo, booking:bookings!inner(transport_status)")
    .eq("cleaner_id", cleanerId)
    .eq("paid_out", false)
    .is("transport_payout_id", null)
    .gt("transport_fare_kobo", 0)
    .eq("booking.transport_status", "paid");

  if (trErr) throw trErr;

  const owedTransportKobo = (transportRows ?? []).reduce(
    (s, r) => s + ((r.transport_fare_kobo as number) ?? 0),
    0,
  );

  // ── Keeper-initiated withdrawals ─────────────────────────────────────────
  // Only this keeper's own on-demand withdrawals (requested_by = 'keeper'),
  // and only those that haven't failed/reversed — a failed transfer put the
  // money back, so it must not reduce the available balance. Admin batch
  // payouts (requested_by = 'admin') settle by flipping the underlying
  // ledger rows instead, so they're excluded here to avoid double-counting.
  const { data: payouts, error: pErr } = await admin
    .from("cleaner_payouts")
    .select("amount_kobo, total_kobo, status")
    .eq("cleaner_id", cleanerId)
    .eq("requested_by", "keeper");

  if (pErr) throw pErr;

  const withdrawnKobo = ((payouts ?? []) as { amount_kobo: number | null; total_kobo: number; status: string }[])
    .filter((p) => p.status !== "failed" && p.status !== "reversed")
    // amount_kobo is the arbitrary keeper-requested amount; total_kobo is the
    // batch fallback for any row that predates amount_kobo being populated.
    .reduce((s, p) => s + (p.amount_kobo ?? p.total_kobo), 0);

  const availableKobo = owedEarningsKobo + owedTransportKobo - withdrawnKobo;

  return {
    owed_earnings_kobo: owedEarningsKobo,
    owed_transport_kobo: owedTransportKobo,
    withdrawn_or_pending_kobo: withdrawnKobo,
    available_kobo: availableKobo,
    total_earned_kobo: totalEarnedKobo,
  };
}
