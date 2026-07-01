import { type NextRequest } from "next/server";
import { verifyAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_req: NextRequest) {
  const unauth = await verifyAdmin();
  if (unauth) return unauth;

  const admin = createAdminClient();

  // Derive the outstanding booking set from cleaner_earnings — the authoritative
  // settled-state ledger — rather than the deprecated keeper_paid_out flag.
  const { data: unpaidEarningsRows, error: ueErr } = await admin
    .from("cleaner_earnings")
    .select("booking_id")
    .eq("status", "unpaid");

  if (ueErr) return Response.json({ error: "Database error" }, { status: 500 });

  const unpaidBookingIds = [
    ...new Set((unpaidEarningsRows ?? []).map((e) => e.booking_id as string)),
  ];
  if (unpaidBookingIds.length === 0) return Response.json({ keepers: [] });

  // All completed bookings that have at least one unpaid earning row.
  const { data, error } = await admin
    .from("bookings")
    .select(`
      id, booking_date, time_slot,
      total_amount_kobo, commission_kobo,
      transport_fare, transport_status,
      cleaner_id,
      service:services(name)
    `)
    .in("id", unpaidBookingIds)
    .eq("status", "completed")
    .not("cleaner_id", "is", null)
    .order("cleaner_id")
    .order("booking_date", { ascending: false });

  if (error) return Response.json({ error: "Database error" }, { status: 500 });

  const rows = data ?? [];
  if (rows.length === 0) return Response.json({ keepers: [] });

  // Group by cleaner_id
  const groups: Record<string, typeof rows> = {};
  for (const row of rows) {
    const cid = row.cleaner_id as string;
    groups[cid] ??= [];
    groups[cid].push(row);
  }

  const cleanerIds = Object.keys(groups);

  const [{ data: cleaners }, { data: accounts }] = await Promise.all([
    admin.from("cleaners").select("id, first_name, last_name, photo_url").in("id", cleanerIds),
    admin
      .from("cleaner_bank_accounts")
      .select("cleaner_id, bank_name, account_number, account_name")
      .in("cleaner_id", cleanerIds)
      .eq("is_primary", true),
  ]);

  type BankRow = { cleaner_id: string; bank_name: string; account_number: string; account_name: string };
  const bankMap: Record<string, BankRow> = {};
  for (const a of (accounts ?? []) as BankRow[]) bankMap[a.cleaner_id] = a;

  const keepers = (cleaners ?? []).map((c) => {
    const bookingRows = (groups[c.id as string] ?? []).map((b) => {
      // clean earnings: keeper's share of the cleaning fee
      const cleanEarningsKobo =
        (b.total_amount_kobo as number) - (b.commission_kobo as number);

      // transport: only reimburse when the customer actually paid the invoice
      const transportReimbNgn =
        b.transport_status === "paid" &&
        b.transport_fare != null &&
        (b.transport_fare as number) > 0
          ? (b.transport_fare as number)
          : 0;

      return {
        booking_id:                  b.id as string,
        booking_date:                b.booking_date as string,
        time_slot:                   (b.time_slot as string | null) ?? null,
        service_name:                ((b.service as unknown as { name: string } | null)?.name) ?? "—",
        total_amount_kobo:           b.total_amount_kobo as number,
        commission_kobo:             b.commission_kobo as number,
        clean_earnings_kobo:         cleanEarningsKobo,
        transport_status:            (b.transport_status as string) ?? "pending_quote",
        transport_fare_ngn:          (b.transport_fare as number | null) ?? null,
        transport_reimbursement_ngn: transportReimbNgn,
      };
    });

    const totalCleanKobo    = bookingRows.reduce((s, r) => s + r.clean_earnings_kobo, 0);
    const totalTransportNgn = bookingRows.reduce((s, r) => s + r.transport_reimbursement_ngn, 0);
    // Normalise clean earnings to NGN and add transport reimbursement
    const totalPayoutNgn    = Math.round(totalCleanKobo / 100) + totalTransportNgn;

    const ba = bankMap[c.id as string];

    return {
      cleaner_id:          c.id as string,
      first_name:          c.first_name as string,
      last_name:           c.last_name as string,
      photo_url:           (c.photo_url as string | null) ?? null,
      has_bank_account:    !!ba,
      bank_name:           ba?.bank_name ?? null,
      account_number:      ba?.account_number ?? null,
      account_name:        ba?.account_name ?? null,
      bookings:            bookingRows,
      total_clean_kobo:    totalCleanKobo,
      total_transport_ngn: totalTransportNgn,
      total_payout_ngn:    totalPayoutNgn,
    };
  }).sort((a, b) => b.total_payout_ngn - a.total_payout_ngn);

  return Response.json({ keepers });
}
