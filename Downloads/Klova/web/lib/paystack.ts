export type NubanResolveResult =
  | { ok: true; accountName: string }
  | { ok: false; status: number; error: string };

// Resolves a Nigerian account number + bank code to the registered account
// name via Paystack. Shared by the keeper resolve preview and the keeper
// bank-account save (which re-resolves server-side rather than trusting the
// name the client displays). Uses the same PAYSTACK_SECRET_KEY the admin
// resolve path already relies on.
export async function resolveNuban(
  accountNumber: string,
  bankCode: string,
): Promise<NubanResolveResult> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    return { ok: false, status: 500, error: "Bank verification is temporarily unavailable" };
  }

  const url = `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    const json = (await res.json()) as {
      status: boolean; message: string; data?: { account_name: string };
    };
    if (!res.ok || !json.status || !json.data) {
      // Resolvable request, unresolvable account — retryable by the keeper.
      return {
        ok: false,
        status: 422,
        error: json.message ?? "Couldn't verify that account. Check the number and try again.",
      };
    }
    return { ok: true, accountName: json.data.account_name };
  } catch {
    return { ok: false, status: 502, error: "Couldn't reach the bank right now. Please try again." };
  }
}
