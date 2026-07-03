import { requireKeeperAuth } from "@/app/api/keeper/_auth";
import { getWalletBalanceKobo } from "@/app/api/keeper/_wallet";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requireKeeperAuth();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  try {
    const available_kobo = await getWalletBalanceKobo(admin, auth.cleanerId);
    return Response.json({ available_kobo });
  } catch {
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}
