import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensurePaystackRecipient, initiateSingleTransfer } from "@/lib/paystackTransfer";

// Re-initiates a stuck/failed keeper withdrawal without double-debiting.
//
// Paystack rejects a reused transfer reference outright regardless of the
// original transfer's outcome ("Please provide a unique reference"),
// verified directly against the live API, this is not a documentation
// assumption. So retrying can never mean "call Paystack again with the same
// reference"; it has to mean a genuinely new transfer attempt for the same
// amount, which means the ONLY thing standing between a safe retry and a
// double payment is our own status check.
//
// Safety, in order:
//  1. Only 'failed'/'reversed' rows are eligible. Paystack itself has
//     already confirmed the original transfer did NOT succeed (funds never
//     left, or came back), so re-sending the same amount is not a duplicate.
//  2. The eligibility check and the claim happen in ONE atomic conditional
//     UPDATE (status IN ('failed','reversed') in the WHERE clause, not a
//     separate SELECT-then-UPDATE). Two concurrent retry clicks can never
//     both pass, since only the first UPDATE's WHERE clause matches; the
//     second sees the row already flipped to 'processing' and affects zero
//     rows. This is the same atomic-claim pattern used throughout this
//     codebase (e.g. processChargeSuccess's matched->confirmed claim).
//  3. The SAME cleaner_payouts row and amount are reused. This is a retry
//     of one withdrawal, not a new one, so it can never inflate what the
//     keeper is owed or paid.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const { id } = await params;
  const admin = createAdminClient();

  const newReference = `klova-kwd-retry-${id.slice(0, 8)}-${Date.now()}`;

  // Atomic claim: only succeeds if this row is still 'failed'/'reversed' at
  // the moment this statement runs. Also scoped to requested_by='keeper':
  // the retired admin-batch path is never eligible for this endpoint.
  const { data: claimed, error: claimErr } = await admin
    .from("cleaner_payouts")
    .update({
      status: "processing",
      paystack_transfer_reference: newReference,
      paystack_transfer_code: null,
      failure_reason: null,
      initiated_at: new Date().toISOString(),
      completed_at: null,
    })
    .eq("id", id)
    .eq("requested_by", "keeper")
    .in("status", ["failed", "reversed"])
    .select("id, cleaner_id, bank_account_id, amount_kobo, total_kobo")
    .maybeSingle();

  if (claimErr) return Response.json({ error: "Database error" }, { status: 500 });
  if (!claimed) {
    return Response.json(
      { error: "This withdrawal isn't in a retryable state (already retried, or not failed/reversed)." },
      { status: 409 },
    );
  }

  const amountKobo = (claimed.amount_kobo ?? claimed.total_kobo) as number;

  try {
    const recipientCode = await ensurePaystackRecipient(admin, claimed.bank_account_id as string);

    const tr = await initiateSingleTransfer({
      recipientCode,
      amountKobo,
      reference: newReference,
      reason: "Klova keeper withdrawal (retry)",
    });

    await admin
      .from("cleaner_payouts")
      .update({ paystack_transfer_code: tr.transfer_code ?? null })
      .eq("id", id);

    return Response.json({ ok: true, status: "processing", reference: newReference });
  } catch (err) {
    // Initiation failed again, mark failed (not stuck in 'processing' with
    // no real transfer behind it) so it remains retryable and the keeper's
    // available balance is unaffected either way.
    const reason = err instanceof Error ? err.message : "transfer failed";
    await admin
      .from("cleaner_payouts")
      .update({ status: "failed", failure_reason: reason.slice(0, 300) })
      .eq("id", id);

    console.error(`[admin-payouts] retry failed for payout ${id}: ${reason}`);
    return Response.json({ error: "Couldn't start the retry transfer. Please try again." }, { status: 502 });
  }
}
