import type { SupabaseClient } from "@supabase/supabase-js";

const PAYSTACK_BASE = "https://api.paystack.co";

async function paystackPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY not configured");

  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { status: boolean; message: string; data: T };
  if (!res.ok || !json.status) {
    throw new Error(`Paystack ${path} failed: ${json.message ?? res.statusText}`);
  }
  return json.data;
}

// Next.js mirror of api/src/services/payoutService.ts ensurePaystackRecipient
// (the Express function can't be imported across deployments). Creates a
// Paystack transfer recipient for the keeper's bank account if one doesn't
// already exist, caching the recipient_code on cleaner_bank_accounts.
// Idempotent — safe to call on every withdrawal.
export async function ensurePaystackRecipient(
  admin: SupabaseClient,
  bankAccountId: string,
): Promise<string> {
  const { data: ba, error } = await admin
    .from("cleaner_bank_accounts")
    .select("id, account_name, account_number, bank_code, paystack_recipient_code")
    .eq("id", bankAccountId)
    .single();

  if (error || !ba) throw error ?? new Error(`Bank account ${bankAccountId} not found`);

  if (ba.paystack_recipient_code) return ba.paystack_recipient_code as string;

  const result = await paystackPost<{ recipient_code: string }>("/transferrecipient", {
    type: "nuban",
    name: ba.account_name,
    account_number: ba.account_number,
    bank_code: ba.bank_code,
    currency: "NGN",
  });

  await admin
    .from("cleaner_bank_accounts")
    .update({ paystack_recipient_code: result.recipient_code })
    .eq("id", bankAccountId);

  return result.recipient_code as string;
}

// Initiates a SINGLE Paystack transfer for an arbitrary amount (kobo). Klova
// bears the transfer fee — source 'balance', amount is exactly what the keeper
// receives. The transfer.success/failed webhook is handled by the existing
// Express handler (matched by `reference`), which finalizes the payout row.
export async function initiateSingleTransfer(params: {
  recipientCode: string;
  amountKobo: number;
  reference: string;
  reason: string;
}): Promise<{ transfer_code?: string; status?: string }> {
  return paystackPost<{ transfer_code?: string; status?: string }>("/transfer", {
    source: "balance",
    amount: params.amountKobo,
    recipient: params.recipientCode,
    reference: params.reference,
    reason: params.reason,
  });
}
