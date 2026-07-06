import { requireKeeperAuth } from "@/app/api/keeper/_auth";
import { getWalletTransactions } from "@/app/api/keeper/_wallet";
import { createAdminClient } from "@/lib/supabase/admin";

// Newest-first feed of the signed-in keeper's earnings, transport
// reimbursements, and withdrawals, for the Wallet screen's transaction
// history. Scoped strictly to the caller's cleaner_id via requireKeeperAuth.
export async function GET() {
  const auth = await requireKeeperAuth();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  try {
    const transactions = await getWalletTransactions(admin, auth.cleanerId);
    return Response.json({ transactions });
  } catch (err) {
    console.error(`[keeper-wallet] getWalletTransactions failed for cleaner ${auth.cleanerId}:`, err);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}
