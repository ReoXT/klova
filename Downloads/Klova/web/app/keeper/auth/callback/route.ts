import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Magic-link landing point. Supabase redirects the keeper here with a PKCE
// `code` after they click the emailed link. We exchange it for a session,
// then link (or verify the link of) the resulting auth user to a cleaners
// row by email — this is the ONLY place auth_user_id ever gets set.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const loginUrl = (error: string) => {
    const url = request.nextUrl.clone();
    url.pathname = "/keeper/login";
    url.search = `?error=${error}`;
    return url;
  };

  if (!code) {
    return NextResponse.redirect(loginUrl("invalid_link"));
  }

  const supabase = await createClient();
  const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeErr) {
    return NextResponse.redirect(loginUrl("invalid_link"));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.redirect(loginUrl("invalid_link"));
  }

  const email = user.email.toLowerCase();
  const admin = createAdminClient();

  // Fast path: already linked by auth_user_id (returning keeper).
  const { data: byAuthId } = await admin
    .from("cleaners")
    .select("id, status, email")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  let cleaner = byAuthId;

  if (!cleaner) {
    // First sign-in: link by email to a cleaner record an admin provisioned.
    // Only match rows not already linked to a DIFFERENT auth user — email
    // uniqueness (uq_cleaners_email_lower) means at most one row can match.
    const { data: byEmail } = await admin
      .from("cleaners")
      .select("id, status, email, auth_user_id")
      .ilike("email", email)
      .maybeSingle();

    if (!byEmail) {
      // No cleaner record was ever invited with this email — reject and
      // sign out so no session lingers for an unlinked account.
      await supabase.auth.signOut();
      return NextResponse.redirect(loginUrl("unlinked"));
    }

    if (byEmail.auth_user_id && byEmail.auth_user_id !== user.id) {
      // Integrity edge case: this cleaner row is already linked to a
      // different auth user than the one who just signed in. Should not
      // happen under normal admin-invite flow — treat as unlinked.
      await supabase.auth.signOut();
      return NextResponse.redirect(loginUrl("unlinked"));
    }

    const { data: linked, error: linkErr } = await admin
      .from("cleaners")
      .update({ auth_user_id: user.id })
      .eq("id", byEmail.id)
      .select("id, status, email")
      .single();

    if (linkErr || !linked) {
      await supabase.auth.signOut();
      return NextResponse.redirect(loginUrl("unlinked"));
    }

    cleaner = linked;
  }

  if (cleaner.status !== "active") {
    await supabase.auth.signOut();
    return NextResponse.redirect(loginUrl("inactive"));
  }

  const dashboardUrl = request.nextUrl.clone();
  dashboardUrl.pathname = "/keeper/dashboard";
  dashboardUrl.search = "";
  return NextResponse.redirect(dashboardUrl);
}
