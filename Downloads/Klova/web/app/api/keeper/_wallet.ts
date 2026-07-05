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

// ─── Transaction history ──────────────────────────────────────────────────────

export type WalletTransactionStatus = "pending" | "processing" | "success" | "failed" | "reversed";

export interface WalletTransaction {
  id: string;
  type: "earning" | "transport" | "withdrawal";
  amount_kobo: number;
  date: string; // ISO timestamp — the credit/request date, used for sorting
  label: string;
  sublabel: string;
  // Only present for type 'withdrawal'. Earnings/transport are one-shot
  // credits with no lifecycle to track.
  status?: WalletTransactionStatus;
}

const TRANSACTION_LIMIT = 50;

type EarningRow = {
  id: string;
  earning_kobo: number;
  created_at: string;
  booking: { service: { name: string } | null } | null;
};

type TransportRow = {
  id: string;
  transport_fare_kobo: number | null;
  booking: { transport_paid_at: string | null; booking_date: string; service: { name: string } | null } | null;
};

type PayoutRow = {
  id: string;
  amount_kobo: number | null;
  total_kobo: number;
  status: WalletTransactionStatus;
  created_at: string;
  bank_account: { bank_name: string; account_number: string } | null;
};

// Unified, newest-first feed of every credit and withdrawal a keeper has ever
// had, for the Wallet screen's transaction history. Three independent
// sources, combined and re-sorted here since they're different tables with
// different date columns:
//   - cleaner_earnings   → one row per completed booking's cleaning fee.
//     'refunded' rows are excluded — earning_kobo is zeroed on a full refund
//     (see adjustEarningForRefund), so there's nothing to show as credited.
//   - booking_cleaners   → transport reimbursement, credited the moment the
//     customer's transport invoice is paid (transport_status='paid'). Shown
//     unconditionally (not just currently-unpaid-out rows) — history is
//     every credit that ever happened, not just what's still outstanding.
//   - cleaner_payouts     → this keeper's own withdrawals (requested_by=
//     'keeper'), each carrying its live status.
export async function getWalletTransactions(
  admin: SupabaseClient,
  cleanerId: string,
): Promise<WalletTransaction[]> {
  const [earningsRes, transportRes, payoutsRes] = await Promise.all([
    admin
      .from("cleaner_earnings")
      .select("id, earning_kobo, created_at, booking:bookings(service:services(name))")
      .eq("cleaner_id", cleanerId)
      .neq("status", "refunded")
      .order("created_at", { ascending: false })
      .limit(TRANSACTION_LIMIT),
    admin
      .from("booking_cleaners")
      .select("id, transport_fare_kobo, booking:bookings!inner(transport_paid_at, booking_date, service:services(name))")
      .eq("cleaner_id", cleanerId)
      .gt("transport_fare_kobo", 0)
      .eq("booking.transport_status", "paid")
      .limit(TRANSACTION_LIMIT),
    admin
      .from("cleaner_payouts")
      .select("id, amount_kobo, total_kobo, status, created_at, bank_account:cleaner_bank_accounts!bank_account_id(bank_name, account_number)")
      .eq("cleaner_id", cleanerId)
      .eq("requested_by", "keeper")
      .order("created_at", { ascending: false })
      .limit(TRANSACTION_LIMIT),
  ]);

  if (earningsRes.error) throw earningsRes.error;
  if (transportRes.error) throw transportRes.error;
  if (payoutsRes.error) throw payoutsRes.error;

  const earningTx: WalletTransaction[] = ((earningsRes.data ?? []) as unknown as EarningRow[]).map((e) => ({
    id: `earning-${e.id}`,
    type: "earning",
    amount_kobo: e.earning_kobo,
    date: e.created_at,
    label: e.booking?.service?.name ?? "Cleaning job",
    sublabel: "Cleaning fee earned",
  }));

  const transportTx: WalletTransaction[] = ((transportRes.data ?? []) as unknown as TransportRow[]).map((r) => ({
    id: `transport-${r.id}`,
    type: "transport",
    amount_kobo: r.transport_fare_kobo ?? 0,
    date: r.booking?.transport_paid_at ?? r.booking?.booking_date ?? new Date(0).toISOString(),
    label: r.booking?.service?.name ?? "Transport",
    sublabel: "Transport reimbursement",
  }));

  const withdrawalTx: WalletTransaction[] = ((payoutsRes.data ?? []) as unknown as PayoutRow[]).map((p) => ({
    id: `withdrawal-${p.id}`,
    type: "withdrawal",
    amount_kobo: p.amount_kobo ?? p.total_kobo,
    date: p.created_at,
    label: "Withdrawal",
    sublabel: p.bank_account
      ? `To ${p.bank_account.bank_name} ****${p.bank_account.account_number.slice(-4)}`
      : "To your bank account",
    status: p.status,
  }));

  return [...earningTx, ...transportTx, ...withdrawalTx]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, TRANSACTION_LIMIT);
}
