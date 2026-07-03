import { type NextRequest } from "next/server";
import { requireKeeperAuth } from "@/app/api/keeper/_auth";
import { projectKeeperEarningKobo, type BookingFinancials } from "@/app/api/keeper/_earnings";
import { deriveArea, ADDRESS_VISIBLE_STATUSES } from "@/app/api/keeper/_area";
import { createAdminClient } from "@/lib/supabase/admin";

interface BookingRow extends BookingFinancials {
  id: string;
  booking_date: string;
  time_slot: string | null;
  address: string;
  bedrooms: string;
  status: string;
  keeper_count: number;
  cancellation_reason: string | null;
  service: { name: string } | null;
  zone: { name: string } | null;
}

// Full detail for a single job. Ownership is enforced by requiring a
// booking_cleaners row for (booking_id, this keeper) — a keeper can never
// view another keeper's job by guessing/changing the id in the URL.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireKeeperAuth();
  if (!auth.ok) return auth.response;

  const { id: bookingId } = await params;
  const admin = createAdminClient();

  const { data: myRow, error: myErr } = await admin
    .from("booking_cleaners")
    .select(`
      role, transport_fare_kobo,
      booking:bookings!inner(
        id, booking_date, time_slot, address, bedrooms, status, keeper_count,
        cancellation_reason,
        base_amount_kobo, addons_amount_kobo, insurance_amount_kobo,
        commission_kobo, total_amount_kobo, refund_kobo,
        service:services(name), zone:zones(name)
      )
    `)
    .eq("cleaner_id", auth.cleanerId)
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (myErr) return Response.json({ error: "Database error" }, { status: 500 });
  if (!myRow) return Response.json({ error: "Not found" }, { status: 404 });

  type MyRow = { role: string; transport_fare_kobo: number | null; booking: BookingRow };
  const { role: rawRole, transport_fare_kobo, booking: b } = myRow as unknown as MyRow;
  const role = rawRole === "lead" ? "lead" : "second";

  const { data: companion } = await admin
    .from("booking_cleaners")
    .select("cleaner:cleaners(first_name)")
    .eq("booking_id", bookingId)
    .neq("cleaner_id", auth.cleanerId)
    .maybeSingle();

  const sharedWith = (companion as unknown as { cleaner: { first_name: string } | null } | null)
    ?.cleaner?.first_name ?? null;

  let earningKobo: number;
  if (b.status === "cancelled") {
    earningKobo = 0;
  } else if (b.status === "completed") {
    const { data: earning } = await admin
      .from("cleaner_earnings")
      .select("earning_kobo")
      .eq("cleaner_id", auth.cleanerId)
      .eq("booking_id", bookingId)
      .maybeSingle();
    earningKobo = (earning?.earning_kobo as number | undefined)
      ?? projectKeeperEarningKobo(b, b.keeper_count, role);
  } else {
    earningKobo = projectKeeperEarningKobo(b, b.keeper_count, role);
  }

  const addressVisible = ADDRESS_VISIBLE_STATUSES.has(b.status);
  const zoneName = b.zone?.name ?? "Lekki / Ajah";

  return Response.json({
    booking_id: b.id,
    status: b.status,
    booking_date: b.booking_date,
    time_slot: b.time_slot,
    service_name: b.service?.name ?? "Cleaning",
    bedrooms: b.bedrooms,
    area: deriveArea(b.address, zoneName),
    zone_name: zoneName,
    full_address: addressVisible ? b.address : null,
    address_available: addressVisible,
    earning_kobo: earningKobo,
    transport_fare_kobo,
    shared_with: sharedWith,
    role,
    cancellation_reason: b.cancellation_reason,
  });
}
