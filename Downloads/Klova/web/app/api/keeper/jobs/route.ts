import { requireKeeperAuth } from "@/app/api/keeper/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

// All confirmed (assigned + paid, not yet completed) jobs for the signed-in
// keeper, scoped via requireKeeperAuth — never a client-supplied cleaner_id.
export async function GET() {
  const auth = await requireKeeperAuth();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("booking_cleaners")
    .select(`
      booking:bookings!inner(
        id, booking_date, time_slot, address, bedrooms, status,
        service:services(name)
      )
    `)
    .eq("cleaner_id", auth.cleanerId)
    .eq("booking.status", "confirmed")
    .order("booking_date", { referencedTable: "bookings", ascending: true })
    .order("time_slot", { referencedTable: "bookings", ascending: true, nullsFirst: false });

  if (error) return Response.json({ error: "Database error" }, { status: 500 });

  type JobRow = {
    id: string; booking_date: string; time_slot: string | null;
    address: string; bedrooms: string;
    service: { name: string } | null;
  };

  const jobs = ((rows ?? []).map((r) => r.booking as unknown as JobRow).filter(Boolean)).map((j) => ({
    booking_id: j.id,
    booking_date: j.booking_date,
    time_slot: j.time_slot,
    address: j.address,
    bedrooms: j.bedrooms,
    service_name: j.service?.name ?? "Cleaning",
  }));

  return Response.json({ jobs });
}
