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
      base_amount_kobo, addons_amount_kobo, insurance_amount_kobo,
      service:services(name),
      zone:zones(name)
    `)
    .in("status", PAID_STATUSES)
    .gte("booking_date", from)
    .lte("booking_date", to);

  if (error) return Response.json({ error: "Database error" }, { status: 500 });

  const rows = data ?? [];

  type Acc = {
    total_bookings: number;
    gross_kobo: number;
    cleaning_fee_kobo: number;
    base_kobo: number;
    addons_kobo: number;
    insurance_kobo: number;
    commission_kobo: number;
  };

  const summary = rows.reduce<Acc>(
    (acc, r) => {
      const base      = (r.base_amount_kobo      as number) ?? 0;
      const addons    = (r.addons_amount_kobo     as number) ?? 0;
      const insurance = (r.insurance_amount_kobo  as number) ?? 0;
      return {
        total_bookings:    acc.total_bookings + 1,
        gross_kobo:        acc.gross_kobo        + (r.total_amount_kobo as number),
        cleaning_fee_kobo: acc.cleaning_fee_kobo + base + addons,
        base_kobo:         acc.base_kobo         + base,
        addons_kobo:       acc.addons_kobo        + addons,
        insurance_kobo:    acc.insurance_kobo     + insurance,
        commission_kobo:   acc.commission_kobo    + (r.commission_kobo  as number),
      };
    },
    { total_bookings: 0, gross_kobo: 0, cleaning_fee_kobo: 0, base_kobo: 0, addons_kobo: 0, insurance_kobo: 0, commission_kobo: 0 },
  );

  type RowAcc = { bookings: number; gross_kobo: number; cleaning_fee_kobo: number; addons_kobo: number; insurance_kobo: number; commission_kobo: number };

  const svcMap: Record<string, RowAcc> = {};
  const zoneMap: Record<string, RowAcc> = {};

  for (const r of rows) {
    const base      = (r.base_amount_kobo      as number) ?? 0;
    const addons    = (r.addons_amount_kobo     as number) ?? 0;
    const insurance = (r.insurance_amount_kobo  as number) ?? 0;
    const cleaning  = base + addons;

    const svc  = (r.service as unknown as { name: string } | null)?.name ?? "Unknown";
    const zone = (r.zone    as unknown as { name: string } | null)?.name ?? "Unknown";

    const blank: RowAcc = { bookings: 0, gross_kobo: 0, cleaning_fee_kobo: 0, addons_kobo: 0, insurance_kobo: 0, commission_kobo: 0 };

    if (!svcMap[svc])   svcMap[svc]   = { ...blank };
    if (!zoneMap[zone]) zoneMap[zone] = { ...blank };

    for (const map of [svcMap[svc], zoneMap[zone]]) {
      map.bookings++;
      map.gross_kobo        += r.total_amount_kobo as number;
      map.cleaning_fee_kobo += cleaning;
      map.addons_kobo       += addons;
      map.insurance_kobo    += insurance;
      map.commission_kobo   += r.commission_kobo as number;
    }
  }

  const by_service = Object.entries(svcMap)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.gross_kobo - a.gross_kobo);

  const by_zone = Object.entries(zoneMap)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.gross_kobo - a.gross_kobo);

  return Response.json({ summary, by_service, by_zone, from, to });
}
