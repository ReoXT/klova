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

  // Collect ALL currently-assigned cleaner IDs from booking_cleaners.
  // For 2-keeper bookings this returns both lead and second; for 1-keeper it returns one.
  const { data: assignedRows } = await admin
    .from("booking_cleaners")
    .select("cleaner_id")
    .eq("booking_id", id);

  const assignedIds = new Set<string>(
    (assignedRows ?? []).map((r) => r.cleaner_id as string),
  );
  // Also include the denormalised cleaner_id column as a safety net
  if (booking.cleaner_id) assignedIds.add(booking.cleaner_id as string);

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
    .filter((cid) => !assignedIds.has(cid));

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
