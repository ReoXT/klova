import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_STATUSES = ["pending", "processing", "success", "failed", "reversed"] as const;
const LIST_LIMIT = 200;

// Every keeper-initiated withdrawal across every keeper (cleaner_payouts,
// requested_by='keeper'), for the admin oversight screen. Read-only: no
// route here ever creates or completes a withdrawal, that's exclusively
// POST /api/keeper/withdraw plus the Paystack transfer webhook.
export async function GET(request: NextRequest) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status");
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";

  if (status && !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return Response.json({ error: "Invalid status filter" }, { status: 400 });
  }

  const admin = createAdminClient();

  let query = admin
    .from("cleaner_payouts")
    .select(`
      id, amount_kobo, total_kobo, status, method, failure_reason,
      paystack_transfer_reference, paystack_transfer_code,
      initiated_at, completed_at, created_at,
      cleaner:cleaners!cleaner_id(id, first_name, last_name, phone),
      bank_account:cleaner_bank_accounts!bank_account_id(bank_name, account_number)
    `)
    .eq("requested_by", "keeper")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return Response.json({ error: "Database error" }, { status: 500 });

  type Row = {
    id: string;
    amount_kobo: number | null;
    total_kobo: number;
    status: string;
    method: string;
    failure_reason: string | null;
    paystack_transfer_reference: string | null;
    paystack_transfer_code: string | null;
    initiated_at: string | null;
    completed_at: string | null;
    created_at: string;
    cleaner: { id: string; first_name: string; last_name: string; phone: string } | null;
    bank_account: { bank_name: string; account_number: string } | null;
  };

  let withdrawals = ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    amount_kobo: r.amount_kobo ?? r.total_kobo,
    status: r.status,
    method: r.method,
    failure_reason: r.failure_reason,
    paystack_transfer_reference: r.paystack_transfer_reference,
    paystack_transfer_code: r.paystack_transfer_code,
    initiated_at: r.initiated_at,
    completed_at: r.completed_at,
    created_at: r.created_at,
    cleaner_id: r.cleaner?.id ?? null,
    cleaner_name: r.cleaner ? `${r.cleaner.first_name} ${r.cleaner.last_name}` : "Unknown",
    cleaner_phone: r.cleaner?.phone ?? null,
    bank_name: r.bank_account?.bank_name ?? null,
    account_number: r.bank_account?.account_number ?? null,
    // Only failed/reversed rows are ever retryable; see the retry route's
    // own status re-check, which is the actual enforcement; this is just
    // what the UI uses to decide whether to show the button.
    can_retry: r.status === "failed" || r.status === "reversed",
  }));

  if (q) {
    withdrawals = withdrawals.filter(
      (w) =>
        w.cleaner_name.toLowerCase().includes(q) ||
        (w.cleaner_phone ?? "").toLowerCase().includes(q) ||
        (w.paystack_transfer_reference ?? "").toLowerCase().includes(q),
    );
  }

  return Response.json({ withdrawals });
}
