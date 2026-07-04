import { type NextRequest } from "next/server";
import { requireKeeperAuth } from "@/app/api/keeper/_auth";
import { bankNameForCode } from "@/lib/nigerianBanks";
import { resolveNuban } from "@/lib/paystack";

// Keeper-facing NUBAN resolution — same Paystack /bank/resolve path the admin
// panel uses, gated by keeper auth. Returns the real account name for the
// keeper to eyeball and confirm before saving. Read-only; nothing is
// persisted here.
export async function GET(request: NextRequest) {
  const auth = await requireKeeperAuth();
  if (!auth.ok) return auth.response;

  const { searchParams } = request.nextUrl;
  const accountNumber = searchParams.get("account_number") ?? "";
  const bankCode      = searchParams.get("bank_code")      ?? "";

  if (!/^\d{10}$/.test(accountNumber)) {
    return Response.json({ error: "Enter a valid 10-digit account number" }, { status: 400 });
  }
  if (!bankCode || !bankNameForCode(bankCode)) {
    return Response.json({ error: "Choose a supported bank" }, { status: 400 });
  }

  const result = await resolveNuban(accountNumber, bankCode);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ account_name: result.accountName });
}
