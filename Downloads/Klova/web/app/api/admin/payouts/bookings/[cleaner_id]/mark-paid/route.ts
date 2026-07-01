import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ cleaner_id: string }> },
) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const { cleaner_id } = await params;
  const admin = createAdminClient();

  // 1. Gather all unpaid cleaning earnings for this keeper.
  //    cleaner_earnings is now the authoritative settled-state ledger.
  const { data: earnings, error: eErr } = await admin
    .from("cleaner_earnings")
    .select("id, booking_id, earning_kobo")
    .eq("cleaner_id", cleaner_id)
    .eq("status", "unpaid");

  if (eErr) return Response.json({ error: "Database error" }, { status: 500 });

  // 2. Gather eligible transport reimbursements: unsettled rows with a positive
  //    fare on a booking whose transport invoice has been paid by the customer.
  const { data: transportRows, error: trErr } = await admin
    .from("booking_cleaners")
    .select("id, booking_id, transport_fare_kobo")
    .eq("cleaner_id", cleaner_id)
    .eq("paid_out", false)
    .gt("transport_fare_kobo", 0);

  if (trErr) return Response.json({ error: "Database error" }, { status: 500 });

  let eligibleTransportIds: string[] = [];
  let transportKobo = 0;

  if (transportRows && transportRows.length > 0) {
    const bookingIds = (transportRows as { booking_id: string }[]).map((r) => r.booking_id);
    const { data: paidBookings, error: pbErr } = await admin
      .from("bookings")
      .select("id")
      .in("id", bookingIds)
      .eq("transport_status", "paid");

    if (pbErr) return Response.json({ error: "Database error" }, { status: 500 });

    const paidIds = new Set((paidBookings ?? []).map((b) => b.id as string));
    for (const row of transportRows as { id: string; booking_id: string; transport_fare_kobo: number }[]) {
      if (!paidIds.has(row.booking_id)) continue;
      transportKobo += row.transport_fare_kobo;
      eligibleTransportIds.push(row.id);
    }
  }

  const earningRows = (earnings ?? []) as { id: string; booking_id: string; earning_kobo: number }[];
  const earningsKobo = earningRows.reduce((s, e) => s + e.earning_kobo, 0);
  const totalKobo = earningsKobo + transportKobo;

  // Idempotent: nothing to do
  if (totalKobo === 0) {
    return Response.json({
      ok: true,
      message: "No unpaid earnings or transport fares — already up to date.",
      booking_count: 0,
      clean_ngn: 0,
      transport_ngn: 0,
      total_payout_ngn: 0,
    });
  }

  const now = new Date().toISOString();

  // 3. Create an audit record if the keeper has a primary bank account on file.
  let payoutId: string | null = null;
  const { data: ba } = await admin
    .from("cleaner_bank_accounts")
    .select("id")
    .eq("cleaner_id", cleaner_id)
    .eq("is_primary", true)
    .maybeSingle();

  if (ba) {
    const { data: payout, error: pErr } = await admin
      .from("cleaner_payouts")
      .insert({
        cleaner_id,
        bank_account_id: (ba as unknown as { id: string }).id,
        total_kobo:      totalKobo,
        method:          "manual",
        status:          "success",
        initiated_at:    now,
        completed_at:    now,
      })
      .select("id")
      .single();

    if (pErr) return Response.json({ error: "Failed to create payout record" }, { status: 500 });
    payoutId = (payout as unknown as { id: string } | null)?.id ?? null;
  }

  // 4. Settle cleaning earnings — status 'paid', linked to the payout row.
  if (earningRows.length > 0) {
    const { error: eUpdateErr } = await admin
      .from("cleaner_earnings")
      .update({ status: "paid", ...(payoutId ? { payout_id: payoutId } : {}) })
      .in("id", earningRows.map((e) => e.id));

    if (eUpdateErr) return Response.json({ error: "Failed to settle earnings" }, { status: 500 });
  }

  // 5. Settle transport reimbursements — paid_out true, linked to the payout row.
  if (eligibleTransportIds.length > 0) {
    const { error: tUpdateErr } = await admin
      .from("booking_cleaners")
      .update({ paid_out: true, ...(payoutId ? { transport_payout_id: payoutId } : {}) })
      .in("id", eligibleTransportIds);

    if (tUpdateErr) return Response.json({ error: "Failed to settle transport" }, { status: 500 });
  }

  const distinctBookingCount = new Set(earningRows.map((e) => e.booking_id)).size;

  return Response.json({
    ok: true,
    booking_count:    distinctBookingCount,
    clean_ngn:        Math.round(earningsKobo / 100),
    transport_ngn:    Math.round(transportKobo / 100),
    total_payout_ngn: Math.round(totalKobo / 100),
    payout_id:        payoutId,
  });
}
