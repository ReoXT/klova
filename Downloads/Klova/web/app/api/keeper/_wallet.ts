import type { SupabaseClient } from "@supabase/supabase-js";

// Unpaid cleaning earnings + settled-but-unpaid transport reimbursements for
// one keeper. Mirrors the admin payout aggregation (api/src/services/
// earningsService.ts getPendingPayoutSummary) but scoped to a single
// cleaner_id instead of all keepers.
export async function getWalletBalanceKobo(
  admin: SupabaseClient,
  cleanerId: string,
): Promise<number> {
  const { data: earnings, error: earnErr } = await admin
    .from("cleaner_earnings")
    .select("earning_kobo")
    .eq("cleaner_id", cleanerId)
    .eq("status", "unpaid");

  if (earnErr) throw earnErr;

  const earningsKobo = (earnings ?? []).reduce((s, e) => s + (e.earning_kobo as number), 0);

  const { data: transportRows, error: trErr } = await admin
    .from("booking_cleaners")
    .select("transport_fare_kobo, booking:bookings!inner(transport_status)")
    .eq("cleaner_id", cleanerId)
    .eq("paid_out", false)
    .is("transport_payout_id", null)
    .gt("transport_fare_kobo", 0)
    .eq("booking.transport_status", "paid");

  if (trErr) throw trErr;

  const transportKobo = (transportRows ?? []).reduce(
    (s, r) => s + ((r.transport_fare_kobo as number) ?? 0),
    0,
  );

  return earningsKobo + transportKobo;
}
