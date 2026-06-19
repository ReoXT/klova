import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const { searchParams } = request.nextUrl;
  const cleanerId = searchParams.get("cleaner_id");
  const from      = searchParams.get("from");
  const to        = searchParams.get("to");

  if (!cleanerId || !from || !to) {
    return Response.json({ error: "Missing cleaner_id, from, or to" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cleaner_availability")
    .select("available_date, is_booked")
    .eq("cleaner_id", cleanerId)
    .gte("available_date", from)
    .lte("available_date", to)
    .order("available_date");

  if (error) return Response.json({ error: "Database error" }, { status: 500 });
  return Response.json({ slots: data ?? [] });
}

export async function POST(request: NextRequest) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const { cleaner_id, add = [], remove = [] } = await request.json() as {
    cleaner_id: string;
    add?: string[];
    remove?: string[];
  };

  if (!cleaner_id) return Response.json({ error: "cleaner_id required" }, { status: 400 });

  const admin = createAdminClient();

  // Find which removals are blocked (date already has a booking)
  const blocked: string[] = [];
  const safeRemoves: string[] = [];

  if (remove.length) {
    const { data: booked } = await admin
      .from("cleaner_availability")
      .select("available_date")
      .eq("cleaner_id", cleaner_id)
      .in("available_date", remove)
      .eq("is_booked", true);

    const bookedSet = new Set((booked ?? []).map((r) => r.available_date as string));
    for (const date of remove) {
      (bookedSet.has(date) ? blocked : safeRemoves).push(date);
    }
  }

  // Add slots (upsert — safe to call even if row exists)
  if (add.length) {
    const { error } = await admin.from("cleaner_availability").upsert(
      add.map((available_date) => ({ cleaner_id, available_date, is_booked: false })),
      { onConflict: "cleaner_id,available_date", ignoreDuplicates: true },
    );
    if (error) return Response.json({ error: "Failed to add slots" }, { status: 500 });
  }

  // Remove safe slots
  if (safeRemoves.length) {
    const { error } = await admin
      .from("cleaner_availability")
      .delete()
      .eq("cleaner_id", cleaner_id)
      .in("available_date", safeRemoves);
    if (error) return Response.json({ error: "Failed to remove slots" }, { status: 500 });
  }

  return Response.json({ ok: true, added: add.length, removed: safeRemoves.length, blocked });
}
