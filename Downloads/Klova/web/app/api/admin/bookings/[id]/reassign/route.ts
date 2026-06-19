import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

const REASSIGNABLE = ["pending_payment", "matched", "paid", "confirmed", "no_match"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { new_cleaner_id } = body as { new_cleaner_id?: string };

  if (!new_cleaner_id) {
    return Response.json({ error: "new_cleaner_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: booking, error: bookingErr } = await admin
    .from("bookings")
    .select("cleaner_id, booking_date, status")
    .eq("id", id)
    .single();

  if (bookingErr || !booking) {
    return Response.json({ error: "Booking not found" }, { status: 404 });
  }

  if (!REASSIGNABLE.includes(booking.status as string)) {
    return Response.json(
      { error: `Cannot reassign a ${booking.status} booking` },
      { status: 422 },
    );
  }

  const { data, error } = await admin.rpc("admin_reassign_cleaner", {
    p_booking_id: id,
    p_old_cleaner_id: booking.cleaner_id ?? null,
    p_new_cleaner_id: new_cleaner_id,
    p_booking_date: booking.booking_date,
  });

  if (error) {
    if (error.message?.includes("cleaner_unavailable")) {
      return Response.json(
        {
          error:
            "That cleaner is no longer available for this date. Refresh and try again.",
        },
        { status: 409 },
      );
    }
    console.error("[admin/reassign]", error);
    return Response.json({ error: "Reassignment failed" }, { status: 500 });
  }

  return Response.json({ success: true, result: data });
}
