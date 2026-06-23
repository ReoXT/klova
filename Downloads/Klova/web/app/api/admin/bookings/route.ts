import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 20;

const BOOKING_SELECT = `
  id, bedrooms, booking_date, time_slot, address,
  total_amount_kobo, commission_kobo, keeper_count,
  status, paystack_reference, refunded_at,
  transport_fare, transport_status, transport_payment_ref,
  transport_paid_at, transport_awaiting_since, dispatched_at,
  cancellation_reason,
  created_at, updated_at,
  customer:customers(id, first_name, last_name, phone, email),
  cleaner:cleaners!cleaner_id(id, first_name, last_name, phone, photo_url, nin_verified, rating, total_jobs, home_area),
  zone:zones(id, name, slug),
  service:services(id, name, slug),
  booking_addons(addon:addons(id, name, slug, amount_kobo)),
  booking_cleaners(id, role, paid_out, transport_fare_kobo, cleaner:cleaners(id, first_name, last_name, phone, photo_url, nin_verified, rating, total_jobs, home_area))
`;

export async function GET(request: NextRequest) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") || null;
  const zoneId = searchParams.get("zone_id") || null;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const offset = (page - 1) * PAGE_SIZE;

  const admin = createAdminClient();

  let query = admin
    .from("bookings")
    .select(BOOKING_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);
  if (zoneId) query = query.eq("zone_id", zoneId);

  const { data, error, count } = await query;

  if (error) {
    console.error("[admin/bookings]", error);
    return Response.json({ error: "Database error" }, { status: 500 });
  }

  const total = count ?? 0;
  return Response.json({
    bookings: data,
    total,
    page,
    limit: PAGE_SIZE,
    pages: Math.ceil(total / PAGE_SIZE),
  });
}
