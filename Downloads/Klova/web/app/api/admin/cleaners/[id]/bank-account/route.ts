import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const { id } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("cleaner_bank_accounts")
    .select("id, account_name, account_number, bank_code, bank_name, is_primary, created_at")
    .eq("cleaner_id", id)
    .eq("is_primary", true)
    .maybeSingle();

  if (error) return Response.json({ error: "Database error" }, { status: 500 });
  return Response.json({ bank_account: data ?? null });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const { id } = await params;
  const body = (await request.json()) as {
    account_name: string;
    account_number: string;
    bank_code: string;
    bank_name: string;
  };

  const errs: Record<string, string> = {};
  if (!body.account_name?.trim())   errs.account_name   = "Required";
  if (!/^\d{10}$/.test(body.account_number ?? "")) errs.account_number = "Must be a 10-digit NUBAN";
  if (!body.bank_code?.trim())      errs.bank_code      = "Required";
  if (!body.bank_name?.trim())      errs.bank_name      = "Required";

  if (Object.keys(errs).length) {
    return Response.json({ errors: errs }, { status: 422 });
  }

  const admin = createAdminClient();

  // Upsert on cleaner_id + is_primary (one primary account per cleaner)
  // Clear old paystack_recipient_code on account number change so it gets re-created
  const { data: existing } = await admin
    .from("cleaner_bank_accounts")
    .select("id, account_number")
    .eq("cleaner_id", id)
    .eq("is_primary", true)
    .maybeSingle();

  const accountChanged = existing && existing.account_number !== body.account_number.trim();

  if (existing) {
    const { data, error } = await admin
      .from("cleaner_bank_accounts")
      .update({
        account_name:  body.account_name.trim(),
        account_number: body.account_number.trim(),
        bank_code:     body.bank_code.trim(),
        bank_name:     body.bank_name.trim(),
        ...(accountChanged ? { paystack_recipient_code: null } : {}),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) return Response.json({ error: "Update failed" }, { status: 500 });
    return Response.json({ bank_account: data });
  }

  const { data, error } = await admin
    .from("cleaner_bank_accounts")
    .insert({
      cleaner_id:     id,
      account_name:   body.account_name.trim(),
      account_number: body.account_number.trim(),
      bank_code:      body.bank_code.trim(),
      bank_name:      body.bank_name.trim(),
      is_primary:     true,
    })
    .select()
    .single();

  if (error) return Response.json({ error: "Failed to save bank account" }, { status: 500 });
  return Response.json({ bank_account: data }, { status: 201 });
}
