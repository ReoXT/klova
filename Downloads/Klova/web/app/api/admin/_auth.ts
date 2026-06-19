import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAIL = "reoxt01@gmail.com";

export async function verifyAdmin(): Promise<Response | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
