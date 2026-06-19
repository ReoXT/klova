import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

const PHONE_RE = /^(\+?234|0)[7-9]\d{9}$/;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

function validatePhone(p: string) {
  return PHONE_RE.test(p.replace(/\s/g, ""));
}

export async function GET() {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cleaners")
    .select("*, zone:zones(id, name, slug)")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: "Database error" }, { status: 500 });
  return Response.json({ cleaners: data ?? [] });
}

export async function POST(request: Request) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const fd = await request.formData();
  const firstName  = (fd.get("first_name")  as string | null)?.trim() ?? "";
  const lastName   = (fd.get("last_name")   as string | null)?.trim() ?? "";
  const phone      = (fd.get("phone")       as string | null)?.trim() ?? "";
  const zoneId     = (fd.get("zone_id")     as string | null)?.trim() ?? "";
  const address    = (fd.get("address")     as string | null)?.trim() ?? null;
  const ninVerified = fd.get("nin_verified") === "true";
  const status     = (fd.get("status")      as string | null) ?? "active";
  const photo      = fd.get("photo") as File | null;

  // Validate
  const errs: Record<string, string> = {};
  if (!firstName) errs.first_name = "Required";
  if (!lastName)  errs.last_name  = "Required";
  if (!phone || !validatePhone(phone)) errs.phone = "Enter a valid Nigerian phone number";
  if (!zoneId)    errs.zone_id    = "Select a zone";
  if (!["active", "inactive", "suspended"].includes(status)) errs.status = "Invalid status";

  if (photo) {
    if (!ALLOWED_MIME.includes(photo.type)) errs.photo = "Only JPEG, PNG or WebP allowed";
    else if (photo.size > MAX_BYTES)        errs.photo = "Photo must be under 5 MB";
  }

  if (Object.keys(errs).length) {
    return Response.json({ errors: errs }, { status: 422 });
  }

  const admin = createAdminClient();

  // Upload photo
  let photoUrl: string | null = null;
  if (photo) {
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

  // Insert cleaner
  const { data: cleaner, error: insertErr } = await admin
    .from("cleaners")
    .insert({ first_name: firstName, last_name: lastName, phone, zone_id: zoneId,
              address: address || null, nin_verified: ninVerified, status, photo_url: photoUrl })
    .select("*")
    .single();

  if (insertErr || !cleaner) {
    return Response.json({ error: "Failed to create cleaner" }, { status: 500 });
  }

  // Seed 90 days of availability for active cleaners
  if (status === "active") {
    const dates = Array.from({ length: 90 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i + 1);
      return d.toISOString().split("T")[0];
    });
    await admin.from("cleaner_availability").insert(
      dates.map((available_date) => ({
        cleaner_id: cleaner.id,
        available_date,
        is_booked: false,
      })),
    );
  }

  return Response.json({ cleaner }, { status: 201 });
}
