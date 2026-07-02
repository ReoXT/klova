import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Admin-only: capture a keeper's email and provision their Supabase Auth
// account with no password. This is the only way a keeper account comes
// into existence — there is no public/self sign-up.
//
// The auth account is created without a password (email_confirm: true, no
// password field) so it only ever works via the passwordless magic-link
// flow at /keeper/login. Linking to the cleaner row (auth_user_id) happens
// later, on the keeper's first successful sign-in, by matching this email.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const { id } = await params;
  const body = (await request.json()) as { email?: string };
  const email = body.email?.trim().toLowerCase() ?? "";

  if (!EMAIL_RE.test(email)) {
    return Response.json({ errors: { email: "Enter a valid email address" } }, { status: 422 });
  }

  const admin = createAdminClient();

  const { data: cleaner, error: cleanerErr } = await admin
    .from("cleaners")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (cleanerErr) return Response.json({ error: "Database error" }, { status: 500 });
  if (!cleaner) return Response.json({ error: "Cleaner not found" }, { status: 404 });

  // Reject if this email is already claimed by a different cleaner record.
  const { data: conflict, error: conflictErr } = await admin
    .from("cleaners")
    .select("id")
    .neq("id", id)
    .ilike("email", email)
    .maybeSingle();

  if (conflictErr) return Response.json({ error: "Database error" }, { status: 500 });
  if (conflict) {
    return Response.json(
      { errors: { email: "This email is already linked to another keeper" } },
      { status: 409 },
    );
  }

  // Provision the Supabase Auth account. No password — sign-in only ever
  // happens via magic link. Idempotent: if the account already exists
  // (e.g. re-inviting after an email typo fix), that's fine, we proceed.
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { role: "keeper", cleaner_id: id },
  });

  if (createErr && !/already.*registered|already.*exists/i.test(createErr.message)) {
    return Response.json({ error: `Failed to provision account: ${createErr.message}` }, { status: 500 });
  }

  const { data: updated, error: updateErr } = await admin
    .from("cleaners")
    .update({ email })
    .eq("id", id)
    .select("id, email, auth_user_id")
    .single();

  if (updateErr) return Response.json({ error: "Failed to save email" }, { status: 500 });

  return Response.json({ ok: true, cleaner: updated });
}
