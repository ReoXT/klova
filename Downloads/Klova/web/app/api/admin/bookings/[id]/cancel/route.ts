import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

const CANCELLABLE = ["pending_payment", "matched", "no_match", "paid", "confirmed"];

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: booking, error } = await admin
    .from("bookings")
    .select("id, status, cleaner_id, booking_date")
    .eq("id", id)
    .single();

  if (error || !booking) {
    return Response.json({ error: "Booking not found" }, { status: 404 });
  }

  if (!CANCELLABLE.includes(booking.status as string)) {
    return Response.json(
      { error: `Cannot cancel a booking with status '${booking.status}'` },
      { status: 422 },
    );
  }

  // Free the cleaner's slot if one was held
  if (booking.cleaner_id && booking.booking_date) {
    await admin
      .from("cleaner_availability")
      .update({ is_booked: false })
      .eq("cleaner_id", booking.cleaner_id)
      .eq("available_date", booking.booking_date);
  }

  // Cancel the booking
  const { error: updateErr } = await admin
    .from("bookings")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateErr) {
    return Response.json({ error: "Failed to cancel booking" }, { status: 500 });
  }

  // Flag if a payment was made so the UI can prompt the admin to refund
  const refundRequired = ["paid", "confirmed"].includes(booking.status as string);

  return Response.json({ success: true, refundRequired });
}
