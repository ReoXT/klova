import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 20;

const BOOKING_SELECT = `
  id, bedrooms, booking_date, address,
  total_amount_kobo, commission_kobo,
  status, paystack_reference, refunded_at,
  created_at, updated_at,
  customer:customers(id, first_name, last_name, phone, email),
  cleaner:cleaners(id, first_name, last_name, phone, photo_url, nin_verified, rating, total_jobs),
  zone:zones(id, name, slug),
  service:services(id, name, slug),
  booking_addons(addon:addons(id, name, slug, amount_kobo))
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
    return Response.json({ error: `Database error: ${error.message} (code: ${error.code})` }, { status: 500 });
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
