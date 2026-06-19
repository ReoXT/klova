import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("zones")
    .select("id, name, slug, is_active")
    .order("name");

  if (error) return Response.json({ error: "Database error" }, { status: 500 });

  return Response.json({ zones: data });
}
