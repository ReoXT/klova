import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

const CONFIRMABLE = ["matched", "paid", "confirmed"];

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
    .select("id, status")
    .eq("id", id)
    .single();

  if (error || !booking) {
    return Response.json({ error: "Booking not found" }, { status: 404 });
  }

  if (!CONFIRMABLE.includes(booking.status as string)) {
    return Response.json(
      { error: `Cannot confirm a booking with status '${booking.status}'` },
      { status: 422 },
    );
  }

  // Flip to confirmed — n8n workflow picks this up and sends the customer email
  if (booking.status !== "confirmed") {
    const { error: updateErr } = await admin
      .from("bookings")
      .update({ status: "confirmed", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateErr) {
      return Response.json({ error: "Failed to update status" }, { status: 500 });
    }
  }

  return Response.json({ success: true });
}
