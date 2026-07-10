import { type NextRequest } from "next/server";
import { requireKeeperAuth } from "@/app/api/keeper/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_HOME_AREA_LEN = 60;

// Everything the keeper is allowed to see about themselves. Only photo_url,
// home_area, latitude, and longitude are ever writable via PATCH below —
// name, phone, zone, nin_verified, status, rating, and total_jobs are
// read-only here by construction.
export async function GET() {
  const auth = await requireKeeperAuth();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  const { data: cleaner, error } = await admin
    .from("cleaners")
    .select(`
      id, first_name, last_name, phone, photo_url, status, nin_verified,
      rating, total_jobs, home_area, latitude, longitude,
      zone:zones(name)
    `)
    .eq("id", auth.cleanerId)
    .single();

  if (error || !cleaner) return Response.json({ error: "Not found" }, { status: 404 });

  // Flat, Lagos-wide area list (supabase/migrations/20260704000001_lagos_areas.sql)
  // — deliberately decoupled from transport_estimates, which is just the
  // Lekki/Ajah fare-corridor matrix, not a general place list.
  const { data: areaRows, error: areaErr } = await admin
    .from("lagos_areas")
    .select("name")
    .order("name", { ascending: true });

  if (areaErr) return Response.json({ error: "Database error" }, { status: 500 });

  const areaSet = new Set((areaRows ?? []).map((r) => r.name as string));
  // Keep the keeper's current value selectable even if it predates the
  // known list, so saving doesn't silently wipe out an existing value.
  if (cleaner.home_area) areaSet.add(cleaner.home_area as string);

  return Response.json({
    cleaner,
    available_areas: [...areaSet].sort((a, b) => a.localeCompare(b)),
  });
}

const LAGOS_BBOX = { minLat: 6.35, maxLat: 6.75, minLng: 2.70, maxLng: 4.00 };

export async function PATCH(request: NextRequest) {
  const auth = await requireKeeperAuth();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const fd = await request.formData();

  const photo = fd.get("photo") as File | null;
  const homeAreaRaw = fd.has("home_area") ? (fd.get("home_area") as string) : undefined;

  // Coordinates: only processed when explicitly sent in the form
  const latRaw = fd.has("latitude")  ? (fd.get("latitude")  as string) : undefined;
  const lngRaw = fd.has("longitude") ? (fd.get("longitude") as string) : undefined;
  const coordsSubmitted = latRaw !== undefined || lngRaw !== undefined;

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
      const { data: areaRows, error: areaErr } = await admin
        .from("lagos_areas")
        .select("name");
      if (areaErr) return Response.json({ error: "Database error" }, { status: 500 });

      const known = new Set((areaRows ?? []).map((r) => (r.name as string).toLowerCase()));
      if (!known.has(trimmed.toLowerCase())) {
        errs.home_area = "Pick an area from the list";
      } else {
        homeArea = trimmed;
      }
    }
  }

  // Validate coordinates: if submitted, both must be present valid numbers.
  // Keepers cannot clear their own coordinates — only admins can.
  let newLat: number | undefined;
  let newLng: number | undefined;
  if (coordsSubmitted) {
    const parsedLat = latRaw !== undefined && latRaw.trim() !== "" ? parseFloat(latRaw) : NaN;
    const parsedLng = lngRaw !== undefined && lngRaw.trim() !== "" ? parseFloat(lngRaw) : NaN;
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      errs.location = "Drop a pin on the map or search an address to set your location.";
    } else {
      newLat = parsedLat;
      newLng = parsedLng;
      // Soft warning (logged but not blocked) if outside Lagos bounding box
      const inLagos =
        newLat >= LAGOS_BBOX.minLat && newLat <= LAGOS_BBOX.maxLat &&
        newLng >= LAGOS_BBOX.minLng && newLng <= LAGOS_BBOX.maxLng;
      if (!inLagos) {
        errs.location = "These coordinates are outside the Lagos service area — double-check the pin.";
      }
    }
  }

  if (Object.keys(errs).length) {
    return Response.json({ errors: errs }, { status: 422 });
  }

  // Fetch old coordinates for audit log before any write
  let oldLat: number | null = null;
  let oldLng: number | null = null;
  if (coordsSubmitted && newLat !== undefined) {
    const { data: cur } = await admin
      .from("cleaners").select("latitude, longitude").eq("id", auth.cleanerId).single();
    oldLat = (cur as { latitude: number | null } | null)?.latitude ?? null;
    oldLng = (cur as { longitude: number | null } | null)?.longitude ?? null;
  }

  // Whitelisted patch — nothing beyond these fields can reach the update.
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
  if (newLat   !== undefined) patch.latitude  = newLat;
  if (newLng   !== undefined) patch.longitude = newLng;

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data: updated, error: updateErr } = await admin
    .from("cleaners")
    .update(patch)
    .eq("id", auth.cleanerId)
    .select(`
      id, first_name, last_name, phone, photo_url, status, nin_verified,
      rating, total_jobs, home_area, latitude, longitude,
      zone:zones(name)
    `)
    .single();

  if (updateErr || !updated) return Response.json({ error: "Update failed" }, { status: 500 });

  // Audit log: only when coordinates actually changed
  if (newLat !== undefined && (newLat !== oldLat || newLng !== oldLng)) {
    await admin.from("cleaner_location_log").insert({
      cleaner_id:      auth.cleanerId,
      old_latitude:    oldLat,
      old_longitude:   oldLng,
      new_latitude:    newLat,
      new_longitude:   newLng ?? null,
      changed_by_role: "keeper",
    });
  }

  return Response.json({ cleaner: updated });
}
