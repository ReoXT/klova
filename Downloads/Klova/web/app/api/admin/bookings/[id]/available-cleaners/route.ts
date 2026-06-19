import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: booking, error: bookingErr } = await admin
    .from("bookings")
    .select("zone_id, booking_date, cleaner_id")
    .eq("id", id)
    .single();

  if (bookingErr || !booking) {
    return Response.json({ error: "Booking not found" }, { status: 404 });
  }

  // Find availability slots that are free on the booking date
  const { data: slots, error: slotsErr } = await admin
    .from("cleaner_availability")
    .select("cleaner_id")
    .eq("available_date", booking.booking_date)
    .eq("is_booked", false);

  if (slotsErr) {
    return Response.json({ error: "Database error" }, { status: 500 });
  }

  const candidateIds = (slots ?? [])
    .map((s) => s.cleaner_id as string)
    .filter((cid) => cid !== booking.cleaner_id);

  if (candidateIds.length === 0) {
    return Response.json({ cleaners: [] });
  }

  // Filter to active cleaners in the same zone
  const { data: cleaners, error: cleanersErr } = await admin
    .from("cleaners")
    .select(
      "id, first_name, last_name, phone, photo_url, nin_verified, rating, total_jobs",
    )
    .in("id", candidateIds)
    .eq("zone_id", booking.zone_id)
    .eq("status", "active")
    .order("rating", { ascending: false, nullsFirst: false });

  if (cleanersErr) {
    return Response.json({ error: "Database error" }, { status: 500 });
  }

  return Response.json({ cleaners: cleaners ?? [] });
}
