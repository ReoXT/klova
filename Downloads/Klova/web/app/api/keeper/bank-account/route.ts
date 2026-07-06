import { requireKeeperAuth } from "@/app/api/keeper/_auth";
import { hasFreshAuth } from "@/app/api/keeper/_reauth";
import { bankNameForCode } from "@/lib/nigerianBanks";
import { resolveNuban } from "@/lib/paystack";
import { createAdminClient } from "@/lib/supabase/admin";

// The signed-in keeper's own primary payout bank account. Scoped strictly to
// their cleaner_id via requireKeeperAuth.
export async function GET() {
  const auth = await requireKeeperAuth();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cleaner_bank_accounts")
    .select("id, account_name, account_number, bank_code, bank_name, is_primary, created_at")
    .eq("cleaner_id", auth.cleanerId)
    .eq("is_primary", true)
    .maybeSingle();

  if (error) return Response.json({ error: "Database error" }, { status: 500 });
  return Response.json({ bank_account: data ?? null });
}

// Create or update the keeper's primary bank account, self-service.
//
// Security posture (a bank change redirects where withdrawals land):
//  - The account NAME is always re-resolved server-side via Paystack from the
//    number + bank; the client-displayed name is never trusted or persisted.
//  - Step-up: requires a recent authentication (not just a refreshed session)
//    before the change takes effect — see _reauth.ts. A stale session gets a
//    401 { reauth_required: true } and the portal walks the keeper through a
//    fresh sign-in.
//  - Every change is written to cleaner_bank_account_audit.
//  - paystack_recipient_code is cleared whenever the account number changes,
//    so a fresh Paystack transfer recipient is created on the next withdrawal.
export async function PUT(request: Request) {
  const auth = await requireKeeperAuth();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    account_number?: string;
    bank_code?: string;
  };
  const accountNumber = (body.account_number ?? "").trim();
  const bankCode = (body.bank_code ?? "").trim();

  // ── Validate ──────────────────────────────────────────────────────────────
  const errs: Record<string, string> = {};
  if (!/^\d{10}$/.test(accountNumber)) errs.account_number = "Must be a 10-digit account number";
  const bankName = bankNameForCode(bankCode);
  if (!bankName) errs.bank_code = "Choose a supported bank";
  if (Object.keys(errs).length) {
    return Response.json({ errors: errs }, { status: 422 });
  }

  // ── Step-up re-authentication ─────────────────────────────────────────────
  if (!(await hasFreshAuth())) {
    return Response.json(
      {
        error: "For your security, please sign in again to change your payout account.",
        reauth_required: true,
      },
      { status: 401 },
    );
  }

  // ── Re-resolve server-side (never trust the client-displayed name) ────────
  const resolved = await resolveNuban(accountNumber, bankCode);
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: resolved.status });
  }
  const accountName = resolved.accountName;

  const admin = createAdminClient();

  const { data: existing, error: exErr } = await admin
    .from("cleaner_bank_accounts")
    .select("id, account_number")
    .eq("cleaner_id", auth.cleanerId)
    .eq("is_primary", true)
    .maybeSingle();

  if (exErr) {
    console.error(`[keeper-bank] lookup failed for cleaner ${auth.cleanerId}:`, exErr);
    return Response.json({ error: "Database error" }, { status: 500 });
  }

  const accountNumberChanged = !!existing && existing.account_number !== accountNumber;
  const oldLast4 = existing ? (existing.account_number as string).slice(-4) : null;

  let saved:
    | { id: string; account_name: string; account_number: string; bank_code: string; bank_name: string }
    | null = null;

  if (existing) {
    const { data, error } = await admin
      .from("cleaner_bank_accounts")
      .update({
        account_name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        bank_name: bankName,
        // New account number ⇒ the old Paystack recipient no longer matches;
        // clear it so a fresh recipient is created on the next withdrawal.
        ...(accountNumberChanged ? { paystack_recipient_code: null } : {}),
      })
      .eq("id", existing.id)
      .select("id, account_name, account_number, bank_code, bank_name")
      .single();
    if (error || !data) {
      console.error(`[keeper-bank] update failed for cleaner ${auth.cleanerId}:`, error);
      return Response.json({ error: "Update failed" }, { status: 500 });
    }
    saved = data;
  } else {
    const { data, error } = await admin
      .from("cleaner_bank_accounts")
      .insert({
        cleaner_id: auth.cleanerId,
        account_name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        bank_name: bankName,
        is_primary: true,
      })
      .select("id, account_name, account_number, bank_code, bank_name")
      .single();
    if (error || !data) {
      console.error(`[keeper-bank] insert failed for cleaner ${auth.cleanerId}:`, error);
      return Response.json({ error: "Failed to save bank account" }, { status: 500 });
    }
    saved = data;
  }

  // ── Audit the sensitive change ────────────────────────────────────────────
  const action = existing ? "updated" : "created";
  await admin.from("cleaner_bank_account_audit").insert({
    cleaner_id: auth.cleanerId,
    auth_user_id: auth.authUserId,
    action,
    old_account_last4: oldLast4,
    new_account_last4: accountNumber.slice(-4),
    new_bank_code: bankCode,
    new_bank_name: bankName,
    resolved_account_name: accountName,
    account_number_changed: existing ? accountNumberChanged : true,
  });

  console.info(
    `[keeper-bank] cleaner=${auth.cleanerId} action=${action} ` +
    `bank=${bankCode} last4=${accountNumber.slice(-4)} number_changed=${existing ? accountNumberChanged : true}`,
  );

  return Response.json({ bank_account: saved });
}
