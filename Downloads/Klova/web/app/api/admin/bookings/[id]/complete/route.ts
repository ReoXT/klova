import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_URL, sendKeeperEmail } from "@/lib/keeperNotify";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: booking, error: fetchErr } = await admin
    .from("bookings")
    .select(`
      id, status, cleaner_id, base_amount_kobo, addons_amount_kobo, insurance_amount_kobo, commission_kobo,
      service:services(name)
    `)
    .eq("id", id)
    .single();

  if (fetchErr || !booking) {
    return Response.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.status !== "confirmed") {
    return Response.json(
      { error: `Only confirmed bookings can be marked complete. Current status: '${booking.status}'` },
      { status: 422 },
    );
  }

  const { error: updateErr } = await admin
    .from("bookings")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateErr) {
    return Response.json({ error: "Failed to update status" }, { status: 500 });
  }

  // Record cleaner earnings: 78% of cleaning fee (base + addons), never insurance
  if (booking.cleaner_id) {
    const cleaningFeeKobo    = (booking.base_amount_kobo as number) + (booking.addons_amount_kobo as number);
    const insuranceKobo      = booking.insurance_amount_kobo as number;
    const commissionKobo     = booking.commission_kobo as number;
    const cleaningCommission = commissionKobo - insuranceKobo; // 22% of cleaning fee only
    const earningKobo        = cleaningFeeKobo - cleaningCommission; // 78% of cleaning fee

    // onConflict must match the live unique constraint added in
    // 20260621000004_split_earnings_per_keeper.sql
    // (cleaner_earnings_booking_cleaner_unique, on (booking_id, cleaner_id))
    // for 2-keeper bookings, NOT the single-column booking_id constraint
    // that migration dropped. Using the wrong target here fails with
    // Postgres error 42P10 ("no unique or exclusion constraint matching the
    // ON CONFLICT specification"), which upsert() surfaces as `error`, not a
    // thrown exception, so an unchecked call silently never records
    // earnings at all.
    const { data: inserted, error: earningErr } = await admin
      .from("cleaner_earnings")
      .upsert(
        {
          booking_id:   id,
          cleaner_id:   booking.cleaner_id,
          earning_kobo: earningKobo,
          status:       "unpaid",
        },
        { onConflict: "booking_id,cleaner_id", ignoreDuplicates: true },
      )
      .select("id");

    if (earningErr) {
      console.error(`[admin-complete] Failed to record earnings for booking ${id}:`, earningErr.message);
    }

    // Only email on a genuine first-time insert. ignoreDuplicates means a
    // retry of an already-completed booking returns no row here, so this
    // naturally skips re-notifying on an idempotent re-call.
    if (inserted && inserted.length > 0) {
      const { data: cleaner } = await admin
        .from("cleaners")
        .select("first_name, email")
        .eq("id", booking.cleaner_id)
        .maybeSingle();

      const service = booking.service as unknown as { name: string } | null;

      void sendKeeperEmail(cleaner?.email ?? null, {
        type: "earnings_credited",
        data: {
          firstName: cleaner?.first_name ?? "there",
          amountNaira: (earningKobo / 100).toLocaleString("en-NG"),
          serviceName: service?.name ?? "your job",
          walletUrl: `${APP_URL}/keeper/wallet`,
        },
      });
    }
  }

  return Response.json({ success: true });
}
