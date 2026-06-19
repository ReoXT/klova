import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

const PAID_STATUSES = ["confirmed", "completed", "paid"];

export async function GET(request: NextRequest) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from") ?? "2020-01-01";
  const to   = searchParams.get("to")   ?? new Date().toISOString().split("T")[0];

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("bookings")
    .select(`
      total_amount_kobo, commission_kobo,
      service:services(name),
      zone:zones(name)
    `)
    .in("status", PAID_STATUSES)
    .gte("booking_date", from)
    .lte("booking_date", to);

  if (error) return Response.json({ error: "Database error" }, { status: 500 });

  const rows = data ?? [];

  // Totals
  const summary = rows.reduce(
    (acc, r) => ({
      total_bookings:  acc.total_bookings + 1,
      gross_kobo:      acc.gross_kobo + (r.total_amount_kobo as number),
      commission_kobo: acc.commission_kobo + (r.commission_kobo as number),
    }),
    { total_bookings: 0, gross_kobo: 0, commission_kobo: 0 },
  );

  // By service
  const svcMap: Record<string, { bookings: number; gross_kobo: number; commission_kobo: number }> = {};
  for (const r of rows) {
    const name = (r.service as { name: string } | null)?.name ?? "Unknown";
    if (!svcMap[name]) svcMap[name] = { bookings: 0, gross_kobo: 0, commission_kobo: 0 };
    svcMap[name].bookings++;
    svcMap[name].gross_kobo      += r.total_amount_kobo as number;
    svcMap[name].commission_kobo += r.commission_kobo  as number;
  }

  // By zone
  const zoneMap: Record<string, { bookings: number; gross_kobo: number; commission_kobo: number }> = {};
  for (const r of rows) {
    const name = (r.zone as { name: string } | null)?.name ?? "Unknown";
    if (!zoneMap[name]) zoneMap[name] = { bookings: 0, gross_kobo: 0, commission_kobo: 0 };
    zoneMap[name].bookings++;
    zoneMap[name].gross_kobo      += r.total_amount_kobo as number;
    zoneMap[name].commission_kobo += r.commission_kobo  as number;
  }

  const by_service = Object.entries(svcMap)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.gross_kobo - a.gross_kobo);

  const by_zone = Object.entries(zoneMap)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.gross_kobo - a.gross_kobo);

  return Response.json({ summary, by_service, by_zone, from, to });
}
