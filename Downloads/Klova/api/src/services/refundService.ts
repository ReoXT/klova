/**
 * Issues a refund for a captured Paystack payment.
 *
 * Stub — wire up the real Paystack call in the payments prompt:
 *   POST https://api.paystack.co/refund  { transaction: paystackReference }
 *   Authorization: Bearer <PAYSTACK_SECRET_KEY>
 */
export async function issueRefund(paystackReference: string): Promise<void> {
  console.log(`[refund] Queued refund for Paystack reference: ${paystackReference}`);
}
