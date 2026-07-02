import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ADMIN_EMAIL = "reoxt01@gmail.com";

// Keeper routes are fully separate from the admin panel: a different
// session-resolution path (cleaners.auth_user_id, not a hardcoded email),
// a different login page, and no shared trust — an admin session grants
// nothing here, and a keeper session grants nothing on /admin/*.
async function handleKeeperRoute(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/keeper/login") || pathname.startsWith("/keeper/auth/callback")) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const loginUrl = (error: string) => {
    const url = request.nextUrl.clone();
    url.pathname = "/keeper/login";
    url.search = `?error=${error}`;
    return NextResponse.redirect(url);
  };

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/keeper/login";
    return NextResponse.redirect(url);
  }

  // Resolve auth_user_id → cleaner via the service-role client, since RLS
  // denies all access to the anon/authenticated roles by design (see
  // supabase/migrations/20260617000003_rls.sql) — every data access path in
  // this app goes through a service-role client with app-level filtering.
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: cleaner } = await admin
    .from("cleaners")
    .select("status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!cleaner) return loginUrl("unlinked");
  if (cleaner.status !== "active") return loginUrl("inactive");

  return supabaseResponse;
}

async function handleAdminRoute(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin/login")) return NextResponse.next();

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/keeper")) return handleKeeperRoute(request);
  return handleAdminRoute(request);
}

export const config = {
  matcher: ["/admin/:path*", "/keeper/:path*"],
};
