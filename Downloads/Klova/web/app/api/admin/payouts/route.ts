import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWalletSummary } from "@/app/api/keeper/_wallet";

// Read-only oversight of every keeper's wallet: available balance, total
// earned, total withdrawn. Computed via getWalletSummary, the exact same
// function the keeper portal's own wallet page calls, so a number shown
// here can never drift from what the keeper themselves sees. There is no
// separate "admin balance" calculation anywhere in this codebase.
export async function GET() {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const admin = createAdminClient();

  const { data: cleaners, error } = await admin
    .from("cleaners")
    .select("id, first_name, last_name, phone, status")
    .neq("status", "suspended")
    .order("first_name");

  if (error) return Response.json({ error: "Database error" }, { status: 500 });

  const summaries = await Promise.all(
    (cleaners ?? []).map(async (c) => {
      try {
        const wallet = await getWalletSummary(admin, c.id as string);
        return {
          cleaner_id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
          phone: c.phone,
          status: c.status,
          ...wallet,
        };
      } catch {
        return null;
      }
    }),
  );

  const keepers = summaries
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.available_kobo - a.available_kobo);

  return Response.json({ keepers });
}
