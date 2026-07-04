import { createClient } from "@/lib/supabase/server";
import { isAmrFresh } from "@/app/api/keeper/_amr";

// Step-up authentication for sensitive keeper actions (changing the bank
// account withdrawals land in). Keeper sessions here never expire, so a
// long-lived or hijacked session shouldn't be able to silently redirect
// payouts. We require the keeper to have *authenticated* (magic-link OTP),
// not merely refreshed a token, within a recent window before the change
// takes effect.
//
// GoTrue records each authentication event in the JWT's `amr` claim
// (Authentication Methods References) as { method, timestamp }. A token
// minted by a fresh sign-in carries a recent amr timestamp; a token minted
// by a routine refresh preserves the original sign-in's amr timestamp. So
// "most-recent amr timestamp within N seconds of now" == "authenticated
// recently", which a plain refresh cannot fake. The recency check itself
// lives in _amr.ts so it can be unit-tested in isolation.
export const REAUTH_MAX_AGE_SECONDS = 15 * 60; // 15 minutes

// Reads the caller's current session and checks step-up freshness. Returns
// true only if the keeper authenticated (not just refreshed) recently.
export async function hasFreshAuth(
  maxAgeSeconds: number = REAUTH_MAX_AGE_SECONDS,
): Promise<boolean> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return false;
  return isAmrFresh(session.access_token, maxAgeSeconds);
}
