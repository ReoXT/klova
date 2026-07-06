import { requireKeeperAuth } from "@/app/api/keeper/_auth";
import { getWalletSummary } from "@/app/api/keeper/_wallet";
import { createAdminClient } from "@/lib/supabase/admin";

// Wallet balance for the signed-in keeper, derived from the existing ledgers
// (cleaner_earnings, booking_cleaners, cleaner_payouts). Scoped strictly to
// the caller's cleaner_id via requireKeeperAuth — never a client-supplied id.
export async function GET() {
  const auth = await requireKeeperAuth();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  try {
    const summary = await getWalletSummary(admin, auth.cleanerId);
    return Response.json(summary);
  } catch (err) {
    console.error(`[keeper-wallet] getWalletSummary failed for cleaner ${auth.cleanerId}:`, err);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}
