import { requireKeeperAuth } from "@/app/api/keeper/_auth";
import { ensurePaystackRecipient, initiateSingleTransfer } from "@/lib/paystackTransfer";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_URL, sendKeeperEmail } from "@/lib/keeperNotify";

// Money-critical. Keeper requests an arbitrary withdrawal amount (kobo).
//
// Flow:
//  1. Validate the amount is a positive integer (no minimum, no cooldown).
//  2. Verify the permanent withdrawal PIN (keeper_verify_withdrawal_pin),
//     a persistent secret, independent of session/reauth freshness. Blocks
//     entirely if no PIN is set yet, or if locked out from repeated wrong
//     guesses. This gate always runs BEFORE any money moves.
//  3. keeper_request_withdrawal RPC atomically re-checks available balance
//     (subtracting pending withdrawals) under a per-keeper advisory lock and,
//     only if sufficient, inserts a 'pending' cleaner_payouts row. Two
//     concurrent requests can never both pass, see the migration.
//  4. Ensure a Paystack recipient, then initiate a single transfer for the
//     amount, storing the reference on the row (so the existing Express
//     transfer webhook can finalize it) and moving it to 'processing'.
//  5. On any Paystack initiation failure, mark the row 'failed' so the
//     reserved amount returns to available.
//
// Scoped strictly to the caller's cleaner_id via requireKeeperAuth.
type WithdrawalRpc =
  | { ok: true; payout_id: string; bank_account_id: string; available_kobo: number }
  | { ok: false; reason: "invalid_amount" | "no_bank" | "insufficient"; available_kobo?: number };

type PinRpc =
  | { ok: true }
  | { ok: false; reason: "invalid_format" | "not_set" | "locked" | "incorrect"; locked_until?: string; attempts_remaining?: number };

export async function POST(request: Request) {
  const auth = await requireKeeperAuth();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as { amount_kobo?: unknown; pin?: unknown };
  const amountKobo = body.amount_kobo;
  const pin = typeof body.pin === "string" ? body.pin : "";

  if (typeof amountKobo !== "number" || !Number.isInteger(amountKobo) || amountKobo <= 0) {
    return Response.json({ error: "Enter a valid amount." }, { status: 422 });
  }
  if (!/^\d{4}$/.test(pin)) {
    return Response.json({ error: "Enter your 4-digit PIN." }, { status: 422 });
  }

  const admin = createAdminClient();

  // ── Permanent PIN gate, runs before anything money-related ──────────────
  const { data: pinData, error: pinErr } = await admin.rpc("keeper_verify_withdrawal_pin", {
    p_cleaner_id: auth.cleanerId,
    p_submitted_pin: pin,
  });

  if (pinErr) return Response.json({ error: "Database error" }, { status: 500 });

  const pinResult = pinData as unknown as PinRpc;

  if (!pinResult.ok) {
    if (pinResult.reason === "not_set") {
      return Response.json(
        { error: "Set up your withdrawal PIN first.", pin_setup_required: true },
        { status: 409 },
      );
    }
    if (pinResult.reason === "locked") {
      return Response.json(
        { error: "Too many incorrect attempts. Try again later, or reset your PIN.", locked_until: pinResult.locked_until },
        { status: 423 },
      );
    }
    return Response.json(
      { error: "Incorrect PIN.", attempts_remaining: pinResult.attempts_remaining ?? 0 },
      { status: 422 },
    );
  }

  // ── Atomic balance check + reservation ────────────────────────────────────
  const { data: rpcData, error: rpcErr } = await admin.rpc("keeper_request_withdrawal", {
    p_cleaner_id: auth.cleanerId,
    p_amount_kobo: amountKobo,
  });

  if (rpcErr) return Response.json({ error: "Database error" }, { status: 500 });

  const rpc = rpcData as unknown as WithdrawalRpc;

  if (!rpc.ok) {
    if (rpc.reason === "no_bank") {
      return Response.json({ error: "Add a payout bank account first." }, { status: 400 });
    }
    if (rpc.reason === "insufficient") {
      return Response.json(
        { error: "That's more than your available balance.", available_kobo: rpc.available_kobo ?? 0 },
        { status: 422 },
      );
    }
    return Response.json({ error: "Enter a valid amount." }, { status: 422 });
  }

  const { payout_id: payoutId, bank_account_id: bankAccountId } = rpc;

  // ── Initiate the Paystack transfer ────────────────────────────────────────
  try {
    const recipientCode = await ensurePaystackRecipient(admin, bankAccountId);
    const reference = `klova-kwd-${payoutId.slice(0, 8)}-${Date.now()}`;

    // Store the reference and flip to 'processing' BEFORE calling Paystack, so
    // a transfer.success webhook (which matches on reference) can never arrive
    // before the row knows its own reference.
    await admin
      .from("cleaner_payouts")
      .update({
        paystack_transfer_reference: reference,
        status: "processing",
        initiated_at: new Date().toISOString(),
      })
      .eq("id", payoutId);

    const tr = await initiateSingleTransfer({
      recipientCode,
      amountKobo,
      reference,
      reason: "Klova keeper withdrawal",
    });

    await admin
      .from("cleaner_payouts")
      .update({ paystack_transfer_code: tr.transfer_code ?? null })
      .eq("id", payoutId);

    // Best-effort notification, never blocks or fails the response below.
    const { data: bank } = await admin
      .from("cleaner_bank_accounts")
      .select("bank_name, account_number")
      .eq("id", bankAccountId)
      .maybeSingle();

    void sendKeeperEmail(auth.cleaner.email, {
      type: "withdrawal_initiated",
      data: {
        firstName: auth.cleaner.first_name,
        amountNaira: (amountKobo / 100).toLocaleString("en-NG"),
        bankName: bank?.bank_name ?? "your bank",
        accountLast4: bank?.account_number ? bank.account_number.slice(-4) : "----",
        walletUrl: `${APP_URL}/keeper/wallet`,
      },
    });

    return Response.json({ ok: true, payout_id: payoutId, amount_kobo: amountKobo, status: "processing" });
  } catch (err) {
    // Initiation failed, return the reserved amount to available.
    const reason = err instanceof Error ? err.message : "transfer failed";
    await admin
      .from("cleaner_payouts")
      .update({ status: "failed", failure_reason: reason.slice(0, 300) })
      .eq("id", payoutId);

    console.error(`[keeper-withdraw] transfer init failed for payout ${payoutId}: ${reason}`);
    return Response.json(
      { error: "Couldn't start the transfer. Your balance is unchanged, please try again." },
      { status: 502 },
    );
  }
}
