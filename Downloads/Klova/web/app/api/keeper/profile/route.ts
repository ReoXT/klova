import { type NextRequest } from "next/server";
import { requireKeeperAuth } from "@/app/api/keeper/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_HOME_AREA_LEN = 60;

// Everything the keeper is allowed to see about themselves. Only photo_url
// and home_area are ever writable via PATCH below — name, phone, zone,
// nin_verified, status, rating, and total_jobs are read-only here by
// construction: this GET returns them, but no code path in this file (or
// anywhere else in /api/keeper/*) ever accepts them as input.
export async function GET() {
  const auth = await requireKeeperAuth();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  const { data: cleaner, error } = await admin
    .from("cleaners")
    .select(`
      id, first_name, last_name, phone, photo_url, status, nin_verified,
      rating, total_jobs, home_area,
      zone:zones(name)
    `)
    .eq("id", auth.cleanerId)
    .single();

  if (error || !cleaner) return Response.json({ error: "Not found" }, { status: 404 });

  // Live list of areas the transport-fare-suggestion system actually knows
  // about, so the home-area picker only offers values that are useful (see
  // supabase/migrations/20260620000002_transport_estimates_helper.sql).
  const { data: estimateRows, error: estErr } = await admin
    .from("transport_estimates")
    .select("from_area, to_area");

  if (estErr) return Response.json({ error: "Database error" }, { status: 500 });

  const areaSet = new Set<string>();
  for (const row of estimateRows ?? []) {
    areaSet.add(row.from_area as string);
    areaSet.add(row.to_area as string);
  }
  // Keep the keeper's current value selectable even if it predates the
  // known list (e.g. a corridor that hasn't been seeded yet) so saving
  // doesn't silently wipe out an existing value.
  if (cleaner.home_area) areaSet.add(cleaner.home_area as string);

  return Response.json({
    cleaner,
    available_areas: [...areaSet].sort((a, b) => a.localeCompare(b)),
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireKeeperAuth();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const fd = await request.formData();

  const photo = fd.get("photo") as File | null;
  const homeAreaRaw = fd.has("home_area") ? (fd.get("home_area") as string) : undefined;

  const errs: Record<string, string> = {};

  if (photo && photo.size > 0) {
    if (!ALLOWED_MIME.includes(photo.type)) errs.photo = "Only JPEG, PNG or WebP allowed";
    else if (photo.size > MAX_BYTES) errs.photo = "Photo must be under 5 MB";
  }

  let homeArea: string | null | undefined;
  if (homeAreaRaw !== undefined) {
    const trimmed = homeAreaRaw.trim();
    if (trimmed === "") {
      homeArea = null;
    } else if (trimmed.length > MAX_HOME_AREA_LEN) {
      errs.home_area = "Too long";
    } else {
      const { data: estimateRows, error: estErr } = await admin
        .from("transport_estimates")
        .select("from_area, to_area");
      if (estErr) return Response.json({ error: "Database error" }, { status: 500 });

      const known = new Set<string>();
      for (const row of estimateRows ?? []) {
        known.add((row.from_area as string).toLowerCase());
        known.add((row.to_area as string).toLowerCase());
      }
      if (!known.has(trimmed.toLowerCase())) {
        errs.home_area = "Pick an area from the list";
      } else {
        homeArea = trimmed;
      }
    }
  }

  if (Object.keys(errs).length) {
    return Response.json({ errors: errs }, { status: 422 });
  }

  // Whitelisted patch, built field-by-field — never spread the raw form
  // body, so nothing beyond photo_url/home_area can ever reach this update
  // regardless of what a client sends.
  const patch: Record<string, unknown> = {};

  if (photo && photo.size > 0) {
    const ext = photo.name.split(".").pop() ?? "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadErr } = await admin.storage
      .from("cleaner-photos")
      .upload(path, Buffer.from(await photo.arrayBuffer()), { contentType: photo.type });

    if (uploadErr) return Response.json({ error: "Photo upload failed" }, { status: 500 });
    patch.photo_url = admin.storage.from("cleaner-photos").getPublicUrl(path).data.publicUrl;
  }

  if (homeArea !== undefined) patch.home_area = homeArea;

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data: updated, error: updateErr } = await admin
    .from("cleaners")
    .update(patch)
    .eq("id", auth.cleanerId)
    .select(`
      id, first_name, last_name, phone, photo_url, status, nin_verified,
      rating, total_jobs, home_area,
      zone:zones(name)
    `)
    .single();

  if (updateErr || !updated) return Response.json({ error: "Update failed" }, { status: 500 });

  return Response.json({ cleaner: updated });
}
