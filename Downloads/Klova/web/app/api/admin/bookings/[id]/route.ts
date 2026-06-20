import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

const BOOKING_SELECT = `
  id, bedrooms, booking_date, time_slot, address,
  total_amount_kobo, commission_kobo,
  status, paystack_reference, refunded_at,
  transport_fare, transport_status, transport_payment_ref,
  transport_paid_at, transport_awaiting_since, dispatched_at,
  cancellation_reason,
  created_at, updated_at,
  customer:customers(id, first_name, last_name, phone, email),
  cleaner:cleaners!cleaner_id(id, first_name, last_name, phone, photo_url, nin_verified, rating, total_jobs, home_area),
  zone:zones(id, name, slug),
  service:services(id, name, slug),
  booking_addons(addon:addons(id, name, slug, amount_kobo))
`;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const { id } = await params;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ error: "Database error" }, { status: 500 });
  }

  return Response.json({ booking: data });
}
