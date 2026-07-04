import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuthedCleaner = {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
};

type KeeperAuthResult =
  | { ok: true; cleanerId: string; authUserId: string; cleaner: AuthedCleaner }
  | { ok: false; response: Response };

// Resolves the signed-in Supabase Auth user to their cleaner record.
// Rejects anyone without a session, anyone not linked to a cleaner row
// (auth_user_id), and anyone whose cleaner record isn't 'active'.
//
// Every /api/keeper/* route must call this first and use the returned
// cleanerId to scope all queries — never accept a client-supplied cleaner_id
// for a keeper-authenticated request.
export async function requireKeeperAuth(): Promise<KeeperAuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: cleaner, error } = await admin
    .from("cleaners")
    .select("id, first_name, last_name, status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error || !cleaner) {
    return { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (cleaner.status !== "active") {
    return { ok: false, response: Response.json({ error: "Account inactive" }, { status: 403 }) };
  }

  return {
    ok: true,
    cleanerId: cleaner.id as string,
    authUserId: user.id,
    cleaner: cleaner as AuthedCleaner,
  };
}
