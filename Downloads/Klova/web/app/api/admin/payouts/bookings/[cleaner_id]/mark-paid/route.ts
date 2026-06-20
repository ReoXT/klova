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

  // Fetch all completed, unpaid bookings for this Keeper.
  const { data: bookings, error: bErr } = await admin
    .from("bookings")
    .select("id, total_amount_kobo, commission_kobo, transport_fare, transport_status")
    .eq("cleaner_id", cleaner_id)
    .eq("status", "completed")
    .eq("keeper_paid_out", false);

  if (bErr) return Response.json({ error: "Database error" }, { status: 500 });

  // Idempotent: if nothing is pending, return success — nothing to do.
  if (!bookings || bookings.length === 0) {
    return Response.json({
      ok: true,
      message: "No unpaid bookings — already up to date.",
      booking_count: 0,
      clean_ngn: 0,
      transport_ngn: 0,
      total_payout_ngn: 0,
    });
  }

  const cleanKobo = bookings.reduce(
    (s, b) => s + ((b.total_amount_kobo as number) - (b.commission_kobo as number)),
    0,
  );
  const transportNgn = bookings.reduce((s, b) => {
    if (
      b.transport_status === "paid" &&
      b.transport_fare != null &&
      (b.transport_fare as number) > 0
    ) {
      return s + (b.transport_fare as number);
    }
    return s;
  }, 0);
  const totalKobo = cleanKobo + Math.round(transportNgn * 100);

  const bookingIds = bookings.map((b) => b.id as string);
  const now = new Date().toISOString();

  // Create a cleaner_payouts audit record if the Keeper has a bank account on file.
  let payoutId: string | null = null;
  const { data: ba } = await admin
    .from("cleaner_bank_accounts")
    .select("id")
    .eq("cleaner_id", cleaner_id)
    .eq("is_primary", true)
    .maybeSingle();

  if (ba) {
    const { data: payout } = await admin
      .from("cleaner_payouts")
      .insert({
        cleaner_id:      cleaner_id,
        bank_account_id: (ba as unknown as { id: string }).id,
        total_kobo:      totalKobo,
        method:          "manual",
        status:          "success",
        initiated_at:    now,
        completed_at:    now,
      })
      .select("id")
      .single();
    payoutId = (payout as unknown as { id: string } | null)?.id ?? null;
  }

  // Flip keeper_paid_out = true — the primary source of truth.
  const { error: updateErr } = await admin
    .from("bookings")
    .update({ keeper_paid_out: true })
    .in("id", bookingIds);

  if (updateErr) return Response.json({ error: "Failed to update bookings" }, { status: 500 });

  return Response.json({
    ok: true,
    booking_count:    bookings.length,
    clean_ngn:        Math.round(cleanKobo / 100),
    transport_ngn:    transportNgn,
    total_payout_ngn: Math.round(totalKobo / 100),
    payout_id:        payoutId,
  });
}
