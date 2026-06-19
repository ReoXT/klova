import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

const PAYSTACK_BASE = "https://api.paystack.co";

async function paystackPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set in Vercel environment variables");

  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { status: boolean; message: string; data: T };
  if (!res.ok || !json.status) {
    throw new Error(`Paystack ${path}: ${json.message ?? res.statusText}`);
  }
  return json.data;
}

/* ── GET /api/admin/payouts ─────────────────────────────────────────────────
   Returns pending payout summary (unpaid per cleaner) + recent history.
*/
export async function GET() {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const admin = createAdminClient();

  // Pending earnings grouped per cleaner
  const { data: earnings, error: eErr } = await admin
    .from("cleaner_earnings")
    .select("cleaner_id, earning_kobo");

  if (eErr) return Response.json({ error: "Database error" }, { status: 500 });

  const unpaidEarnings = (earnings ?? []).filter((e) => {
    // status is 'unpaid' - but we didn't select it; select it instead
    return true; // handled below with separate query
  });
  // Re-fetch with status filter
  const { data: unpaid, error: uErr } = await admin
    .from("cleaner_earnings")
    .select("cleaner_id, earning_kobo")
    .eq("status", "unpaid");

  if (uErr) return Response.json({ error: "Database error" }, { status: 500 });

  // Group by cleaner
  const grouped: Record<string, { jobs: number; kobo: number }> = {};
  for (const e of unpaid ?? []) {
    const cid = e.cleaner_id as string;
    if (!grouped[cid]) grouped[cid] = { jobs: 0, kobo: 0 };
    grouped[cid].jobs++;
    grouped[cid].kobo += e.earning_kobo as number;
  }

  const cleanerIds = Object.keys(grouped);
  let pending: unknown[] = [];

  if (cleanerIds.length > 0) {
    const [{ data: cleaners }, { data: accounts }] = await Promise.all([
      admin.from("cleaners").select("id, first_name, last_name, photo_url").in("id", cleanerIds),
      admin.from("cleaner_bank_accounts").select("id, cleaner_id, bank_name, account_number, account_name").in("cleaner_id", cleanerIds).eq("is_primary", true),
    ]);

    type BankAccountRow = { id: string; cleaner_id: string; bank_name: string; account_number: string; account_name: string };
    const accountMap: Record<string, BankAccountRow> = {};
    for (const a of accounts ?? []) accountMap[a.cleaner_id as string] = a;

    pending = (cleaners ?? []).map((c) => {
      const g  = grouped[c.id as string];
      const ba = accountMap[c.id as string];
      return {
        cleaner_id:       c.id,
        first_name:       c.first_name,
        last_name:        c.last_name,
        photo_url:        c.photo_url ?? null,
        unpaid_jobs:      g.jobs,
        unpaid_kobo:      g.kobo,
        has_bank_account: !!ba,
        bank_account_id:  ba?.id ?? null,
        bank_name:        ba?.bank_name ?? null,
        account_number:   ba?.account_number ?? null,
        account_name:     ba?.account_name ?? null,
      };
    }).sort((a: { unpaid_kobo: number }, b: { unpaid_kobo: number }) => b.unpaid_kobo - a.unpaid_kobo);
  }

  // Payout history
  const { data: history, error: hErr } = await admin
    .from("cleaner_payouts")
    .select(`
      id, cleaner_id, total_kobo, method, status, failure_reason,
      initiated_at, completed_at, created_at,
      cleaner:cleaners!cleaner_id(first_name, last_name),
      bank_account:cleaner_bank_accounts!bank_account_id(bank_name, account_number)
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  if (hErr) return Response.json({ error: "Database error" }, { status: 500 });

  const historyRows = (history ?? []).map((r) => {
    const c = r.cleaner as unknown as { first_name: string; last_name: string } | null;
    const b = r.bank_account as unknown as { bank_name: string; account_number: string } | null;
    return {
      id:                 r.id,
      cleaner_id:         r.cleaner_id,
      cleaner_first_name: c?.first_name ?? "—",
      cleaner_last_name:  c?.last_name  ?? "",
      total_kobo:         r.total_kobo,
      method:             r.method,
      status:             r.status,
      failure_reason:     r.failure_reason ?? null,
      initiated_at:       r.initiated_at ?? null,
      completed_at:       r.completed_at ?? null,
      created_at:         r.created_at,
      bank_name:          b?.bank_name      ?? null,
      account_number:     b?.account_number ?? null,
    };
  });

  return Response.json({ pending, history: historyRows });
}

/* ── POST /api/admin/payouts ────────────────────────────────────────────────
   Body: { cleaner_ids: string[] }
   Initiates Paystack bulk transfers for each cleaner.
*/
export async function POST(request: NextRequest) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const body = (await request.json()) as { cleaner_ids: string[] };
  if (!Array.isArray(body.cleaner_ids) || body.cleaner_ids.length === 0) {
    return Response.json({ error: "cleaner_ids must be a non-empty array" }, { status: 400 });
  }

  const admin = createAdminClient();
  const success: string[] = [];
  const failed: { cleaner_id: string; reason: string }[] = [];

  for (const cleanerId of body.cleaner_ids) {
    try {
      // 1. Unpaid earnings for this cleaner
      const { data: unpaid, error: uErr } = await admin
        .from("cleaner_earnings")
        .select("id, earning_kobo")
        .eq("cleaner_id", cleanerId)
        .eq("status", "unpaid");

      if (uErr) throw uErr;
      if (!unpaid || unpaid.length === 0) continue;

      const totalKobo = (unpaid as { id: string; earning_kobo: number }[]).reduce((s, e) => s + e.earning_kobo, 0);

      // 2. Primary bank account
      const { data: ba, error: baErr } = await admin
        .from("cleaner_bank_accounts")
        .select("id, account_number, bank_code, account_name, paystack_recipient_code")
        .eq("cleaner_id", cleanerId)
        .eq("is_primary", true)
        .single();

      if (baErr || !ba) throw new Error("No primary bank account on file");

      // 3. Ensure Paystack recipient
      let recipientCode = ba.paystack_recipient_code as string | null;
      if (!recipientCode) {
        const result = await paystackPost<{ recipient_code: string }>("/transferrecipient", {
          type:           "nuban",
          name:           ba.account_name,
          account_number: ba.account_number,
          bank_code:      ba.bank_code,
          currency:       "NGN",
        });
        recipientCode = result.recipient_code;
        await admin.from("cleaner_bank_accounts").update({ paystack_recipient_code: recipientCode }).eq("id", ba.id);
      }

      // 4. Reference
      const reference = `klova-payout-${cleanerId.slice(0, 8)}-${Date.now()}`;

      // 5. Create payout row
      const { data: payout, error: pErr } = await admin
        .from("cleaner_payouts")
        .insert({
          cleaner_id:      cleanerId,
          bank_account_id: ba.id,
          total_kobo:      totalKobo,
          method:          "paystack",
          status:          "pending",
          paystack_transfer_reference: reference,
          initiated_at:    new Date().toISOString(),
        })
        .select("id")
        .single();

      if (pErr || !payout) throw pErr ?? new Error("Failed to create payout row");

      // 6. Initiate Paystack transfer
      const transfers = [{ amount: totalKobo, reference, reason: "Klova cleaner earnings payout", recipient: recipientCode }];
      const results = await paystackPost<{ transfer_code?: string; status: string }[]>("/transfer/bulk", {
        currency: "NGN", source: "balance", transfers,
      });
      const tr = results[0];

      await admin.from("cleaner_payouts")
        .update({ status: "processing", paystack_transfer_code: tr.transfer_code ?? null })
        .eq("id", payout.id);

      await admin.from("cleaner_earnings")
        .update({ status: "scheduled", payout_id: payout.id })
        .eq("cleaner_id", cleanerId)
        .eq("status", "unpaid");

      success.push(cleanerId);
    } catch (err) {
      failed.push({ cleaner_id: cleanerId, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return Response.json({ success, failed });
}
