import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

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
    .select("id, status, cleaner_id, base_amount_kobo, addons_amount_kobo, insurance_amount_kobo, commission_kobo")
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

    await admin.from("cleaner_earnings").upsert(
      {
        booking_id:   id,
        cleaner_id:   booking.cleaner_id,
        earning_kobo: earningKobo,
        status:       "unpaid",
      },
      { onConflict: "booking_id", ignoreDuplicates: true },
    );
  }

  return Response.json({ success: true });
}
