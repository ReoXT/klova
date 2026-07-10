import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

const PHONE_RE = /^(\+?234|0)[7-9]\d{9}$/;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

function validatePhone(p: string) {
  return PHONE_RE.test(p.replace(/\s/g, ""));
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const { id } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cleaners")
    .select("*, zone:zones(id, name, slug)")
    .eq("id", id)
    .single();

  if (error) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ cleaner: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const { id } = await params;
  const fd = await request.formData();

  const firstName   = (fd.get("first_name")  as string | null)?.trim();
  const lastName    = (fd.get("last_name")   as string | null)?.trim();
  const phone       = (fd.get("phone")       as string | null)?.trim();
  const zoneId      = (fd.get("zone_id")     as string | null)?.trim();
  const address     = (fd.get("address")     as string | null)?.trim();
  const ninVerified = fd.has("nin_verified") ? fd.get("nin_verified") === "true" : undefined;
  const status      = (fd.get("status")      as string | null) ?? undefined;
  const photo       = fd.get("photo") as File | null;
  // Always sent from the form; empty string means "clear to null"
  const latRaw      = (fd.get("latitude")    as string | null);
  const lngRaw      = (fd.get("longitude")   as string | null);
  const latitude    = latRaw  !== null ? (latRaw.trim()  ? parseFloat(latRaw.trim())  : null) : undefined;
  const longitude   = lngRaw !== null ? (lngRaw.trim() ? parseFloat(lngRaw.trim()) : null) : undefined;

  const errs: Record<string, string> = {};
  if (firstName !== undefined && !firstName)  errs.first_name = "Required";
  if (lastName  !== undefined && !lastName)   errs.last_name  = "Required";
  if (phone     !== undefined && !validatePhone(phone)) errs.phone = "Enter a valid Nigerian phone number";
  if (status    !== undefined && !["active","inactive","suspended"].includes(status)) errs.status = "Invalid status";

  if (photo && photo.size > 0) {
    if (!ALLOWED_MIME.includes(photo.type)) errs.photo = "Only JPEG, PNG or WebP allowed";
    else if (photo.size > MAX_BYTES)        errs.photo = "Photo must be under 5 MB";
  }

  if (Object.keys(errs).length) {
    return Response.json({ errors: errs }, { status: 422 });
  }

  const admin = createAdminClient();

  // Upload new photo if provided
  let photoUrl: string | undefined;
  if (photo && photo.size > 0) {
    const ext  = photo.name.split(".").pop() ?? "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadErr } = await admin.storage
      .from("cleaner-photos")
      .upload(path, Buffer.from(await photo.arrayBuffer()), { contentType: photo.type });

    if (uploadErr) {
      return Response.json({ error: "Photo upload failed" }, { status: 500 });
    }
    photoUrl = admin.storage.from("cleaner-photos").getPublicUrl(path).data.publicUrl;
  }

  // Fetch old coordinates before update so we can log the change
  let oldLat: number | null = null;
  let oldLng: number | null = null;
  const coordsChanging = latitude !== undefined || longitude !== undefined;
  if (coordsChanging) {
    const { data: cur } = await admin
      .from("cleaners").select("latitude, longitude").eq("id", id).single();
    oldLat = (cur as { latitude: number | null } | null)?.latitude ?? null;
    oldLng = (cur as { longitude: number | null } | null)?.longitude ?? null;
  }

  const patch: Record<string, unknown> = {};
  if (firstName   !== undefined) patch.first_name   = firstName;
  if (lastName    !== undefined) patch.last_name    = lastName;
  if (phone       !== undefined) patch.phone        = phone;
  if (zoneId      !== undefined) patch.zone_id      = zoneId;
  if (address     !== undefined) patch.address      = address || null;
  if (ninVerified !== undefined) patch.nin_verified = ninVerified;
  if (status      !== undefined) patch.status       = status;
  if (photoUrl    !== undefined) patch.photo_url    = photoUrl;
  if (latitude    !== undefined) patch.latitude     = latitude;
  if (longitude   !== undefined) patch.longitude    = longitude;

  const { data, error } = await admin
    .from("cleaners")
    .update(patch)
    .eq("id", id)
    .select("*, zone:zones(id, name, slug)")
    .single();

  if (error) {
    if (error.code === "23505" && error.message.includes("phone")) {
      return Response.json({ errors: { phone: "A cleaner with this phone number already exists" } }, { status: 422 });
    }
    return Response.json({ error: "Update failed" }, { status: 500 });
  }

  // Log coordinate changes for audit trail
  if (coordsChanging && data) {
    const newLat = (data as unknown as { latitude: number | null }).latitude ?? null;
    const newLng = (data as unknown as { longitude: number | null }).longitude ?? null;
    if (newLat !== oldLat || newLng !== oldLng) {
      await admin.from("cleaner_location_log").insert({
        cleaner_id: id, old_latitude: oldLat, old_longitude: oldLng,
        new_latitude: newLat, new_longitude: newLng, changed_by_role: "admin",
      });
    }
  }

  return Response.json({ cleaner: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const { id } = await params;
  const admin = createAdminClient();

  // Block deletion if cleaner has any live bookings
  const { data: live } = await admin
    .from("bookings")
    .select("id")
    .eq("cleaner_id", id)
    .in("status", ["matched", "confirmed"])
    .limit(1);

  if (live && live.length > 0) {
    return Response.json(
      { error: "This cleaner has active bookings and cannot be deleted. Reassign or cancel those bookings first." },
      { status: 409 },
    );
  }

  const { error } = await admin.from("cleaners").delete().eq("id", id);
  if (error) return Response.json({ error: "Delete failed" }, { status: 500 });

  return new Response(null, { status: 204 });
}
