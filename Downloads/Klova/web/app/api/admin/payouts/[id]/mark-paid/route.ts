import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/admin/payouts/[id]/mark-paid
 * [id] is the cleaner_id. Marks all unpaid earnings as paid without Paystack.
 * Use when manually transferring via bank or when Paystack Transfers is not yet activated.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const { id: cleanerId } = await params;
  const admin = createAdminClient();

  const { data: unpaid, error: uErr } = await admin
    .from("cleaner_earnings")
    .select("id, earning_kobo")
    .eq("cleaner_id", cleanerId)
    .eq("status", "unpaid");

  if (uErr) return Response.json({ error: "Database error" }, { status: 500 });
  if (!unpaid || unpaid.length === 0) {
    return Response.json({ error: "No unpaid earnings for this cleaner" }, { status: 422 });
  }

  const { data: ba, error: baErr } = await admin
    .from("cleaner_bank_accounts")
    .select("id")
    .eq("cleaner_id", cleanerId)
    .eq("is_primary", true)
    .maybeSingle();

  if (baErr) return Response.json({ error: "Database error" }, { status: 500 });
  if (!ba) return Response.json({ error: "No bank account on file for this cleaner" }, { status: 422 });

  const totalKobo = (unpaid as { id: string; earning_kobo: number }[]).reduce((s, e) => s + e.earning_kobo, 0);
  const now = new Date().toISOString();

  const { data: payout, error: pErr } = await admin
    .from("cleaner_payouts")
    .insert({
      cleaner_id:      cleanerId,
      bank_account_id: ba.id,
      total_kobo:      totalKobo,
      method:          "manual",
      status:          "success",
      initiated_at:    now,
      completed_at:    now,
    })
    .select("id")
    .single();

  if (pErr || !payout) return Response.json({ error: "Failed to record payout" }, { status: 500 });

  await admin
    .from("cleaner_earnings")
    .update({ status: "paid", payout_id: payout.id })
    .eq("cleaner_id", cleanerId)
    .eq("status", "unpaid");

  return Response.json({ success: true, payout_id: payout.id, total_kobo: totalKobo });
}
