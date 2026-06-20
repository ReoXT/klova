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

  // Fetch the booking's keeper home_area and zone name
  const { data: booking } = await admin
    .from("bookings")
    .select("cleaner:cleaners!cleaner_id(home_area), zone:zones(name)")
    .eq("id", id)
    .single();

  const cleaner = booking?.cleaner as unknown as { home_area: string | null } | null;
  const zone = booking?.zone as unknown as { name: string } | null;

  if (!cleaner?.home_area || !zone?.name) {
    return Response.json({ suggestion: null });
  }

  // Best-effort: try keeper_area ↔ zone_name. Returns null if no corridor matches.
  const { data } = await admin.rpc("get_transport_suggestion", {
    p_keeper_area:   cleaner.home_area,
    p_customer_area: zone.name,
  });

  return Response.json({ suggestion: (data as number | null) ?? null });
}
