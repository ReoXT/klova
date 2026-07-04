import { requireKeeperAuth } from "@/app/api/keeper/_auth";
import { hasFreshAuth } from "@/app/api/keeper/_reauth";
import { createAdminClient } from "@/lib/supabase/admin";

// State of the signed-in keeper's withdrawal PIN — never exposes pin_hash.
export async function GET() {
  const auth = await requireKeeperAuth();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("keeper_withdrawal_pins")
    .select("locked_until")
    .eq("cleaner_id", auth.cleanerId)
    .maybeSingle();

  if (error) return Response.json({ error: "Database error" }, { status: 500 });

  const lockedUntil = data?.locked_until ?? null;
  const locked = !!lockedUntil && new Date(lockedUntil).getTime() > Date.now();

  return Response.json({ is_set: !!data, locked, locked_until: lockedUntil });
}

// Sets or changes the keeper's permanent withdrawal PIN — deliberately NOT
// tied to session freshness for its later USE (see /keeper/withdraw), but
// setting/changing it is itself sensitive (it's the only way to clear a
// lockout, and a stolen unlocked phone must not be able to silently install
// its own PIN), so this requires the same step-up reauth as changing the
// bank account.
export async function PUT(request: Request) {
  const auth = await requireKeeperAuth();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as { pin?: unknown; confirm_pin?: unknown };
  const pin = typeof body.pin === "string" ? body.pin : "";
  const confirmPin = typeof body.confirm_pin === "string" ? body.confirm_pin : "";

  const errs: Record<string, string> = {};
  if (!/^\d{4}$/.test(pin)) errs.pin = "Enter a 4-digit PIN";
  if (!errs.pin && pin !== confirmPin) errs.confirm_pin = "PINs don't match";
  if (Object.keys(errs).length) {
    return Response.json({ errors: errs }, { status: 422 });
  }

  if (!(await hasFreshAuth())) {
    return Response.json(
      {
        error: "For your security, please sign in again to set your withdrawal PIN.",
        reauth_required: true,
      },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("keeper_set_withdrawal_pin", {
    p_cleaner_id: auth.cleanerId,
    p_new_pin: pin,
  });

  if (error) return Response.json({ error: "Database error" }, { status: 500 });

  const result = data as { ok: boolean; reason?: string };
  if (!result.ok) {
    if (result.reason === "weak_pin") {
      return Response.json({ errors: { pin: "Choose a less predictable PIN" } }, { status: 422 });
    }
    return Response.json({ errors: { pin: "Enter a 4-digit PIN" } }, { status: 422 });
  }

  console.info(`[keeper-withdrawal-pin] cleaner=${auth.cleanerId} pin set/changed`);

  return Response.json({ ok: true });
}
