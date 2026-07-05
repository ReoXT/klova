import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Records an audited manual correction to a keeper's wallet balance
// (cleaner_wallet_adjustments; see that table's migration for why it's
// separate from cleaner_payouts). A note is mandatory: this exists for rare
// corrections, and every one must be explained, not just logged as a number.
export async function POST(request: Request) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const body = (await request.json().catch(() => ({}))) as {
    cleaner_id?: unknown;
    amount_kobo?: unknown;
    note?: unknown;
  };

  const cleanerId = typeof body.cleaner_id === "string" ? body.cleaner_id : "";
  const amountKobo = body.amount_kobo;
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!cleanerId) {
    return Response.json({ error: "Missing cleaner_id" }, { status: 422 });
  }
  if (typeof amountKobo !== "number" || !Number.isInteger(amountKobo) || amountKobo === 0) {
    return Response.json({ error: "Enter a non-zero adjustment amount." }, { status: 422 });
  }
  if (!note) {
    return Response.json({ error: "A note explaining this correction is required." }, { status: 422 });
  }

  const admin = createAdminClient();

  const { data: cleaner, error: cleanerErr } = await admin
    .from("cleaners")
    .select("id")
    .eq("id", cleanerId)
    .maybeSingle();

  if (cleanerErr) return Response.json({ error: "Database error" }, { status: 500 });
  if (!cleaner) return Response.json({ error: "Keeper not found" }, { status: 404 });

  const { data: adjustment, error } = await admin
    .from("cleaner_wallet_adjustments")
    .insert({ cleaner_id: cleanerId, amount_kobo: amountKobo, note })
    .select("id")
    .single();

  if (error) return Response.json({ error: "Database error" }, { status: 500 });

  console.info(`[admin-payouts] adjustment ${adjustment.id} for cleaner ${cleanerId}: ${amountKobo} kobo, note: ${note}`);

  return Response.json({ ok: true, adjustment_id: adjustment.id });
}
