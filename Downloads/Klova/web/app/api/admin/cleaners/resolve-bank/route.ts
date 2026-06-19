import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";

export async function GET(request: NextRequest) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const { searchParams } = request.nextUrl;
  const accountNumber = searchParams.get("account_number") ?? "";
  const bankCode      = searchParams.get("bank_code")      ?? "";

  if (!/^\d{10}$/.test(accountNumber) || !bankCode) {
    return Response.json({ error: "account_number (10 digits) and bank_code are required" }, { status: 400 });
  }

  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    return Response.json({ error: "PAYSTACK_SECRET_KEY not configured" }, { status: 500 });
  }

  const url = `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  const json = await res.json() as { status: boolean; message: string; data?: { account_name: string; account_number: string } };

  if (!res.ok || !json.status || !json.data) {
    return Response.json({ error: json.message ?? "Could not resolve account" }, { status: 422 });
  }

  return Response.json({ account_name: json.data.account_name });
}
