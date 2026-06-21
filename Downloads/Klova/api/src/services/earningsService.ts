import { supabase } from '../lib/supabase';

export interface EarningSummary {
  cleaner_id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  unpaid_jobs: number;
  unpaid_kobo: number;
  pending_transport_kobo: number; // settled transport not yet paid out to this keeper
  has_bank_account: boolean;
  bank_account_id: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
}

export interface PayoutHistoryRow {
  id: string;
  cleaner_id: string;
  cleaner_first_name: string;
  cleaner_last_name: string;
  total_kobo: number;
  method: string;
  status: string;
  failure_reason: string | null;
  initiated_at: string | null;
  completed_at: string | null;
  created_at: string;
  bank_name: string | null;
  account_number: string | null;
}

/**
 * Called when a booking transitions to 'completed'.
 *
 * Reads the authoritative keeper list from booking_cleaners, computes the
 * total keeper earning (cleaning fee minus commission, net of insurance —
 * roughly 78% of the cleaning fee), then splits it EVENLY across all keepers:
 *
 *   per_keeper = floor(total / keeper_count)
 *   remainder  = total % keeper_count  (0 or 1 kobo for any realistic total)
 *   lead keeper (role='lead', index 0) receives per_keeper + remainder
 *
 * This guarantees:  SUM(per_keeper_earning) === total_earning  exactly.
 *
 * Insurance and transport fare are NOT part of the split:
 *   - Insurance is 100% Klova revenue (already excluded from the formula).
 *   - Transport is a pass-through paid separately per keeper via booking_cleaners.
 *
 * Idempotent: UNIQUE (booking_id, cleaner_id) prevents duplicate rows.
 * If the booking already has a refund, each row is inserted as 'refunded'.
 */
export async function recordEarning(bookingId: string): Promise<void> {
  // 1. Load booking financials — no cleaner_id needed (comes from booking_cleaners)
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('base_amount_kobo, addons_amount_kobo, insurance_amount_kobo, commission_kobo, total_amount_kobo, refund_kobo')
    .eq('id', bookingId)
    .eq('status', 'completed')
    .single();

  if (bErr || !booking) {
    throw bErr ?? new Error(`Booking ${bookingId} not found or not completed`);
  }

  // 2. Get the assigned keeper list from booking_cleaners (lead first via role ASC)
  const { data: keeperRows, error: kErr } = await supabase
    .from('booking_cleaners')
    .select('cleaner_id')
    .eq('booking_id', bookingId)
    .order('role', { ascending: true }); // 'lead' < 'second' alphabetically

  if (kErr) throw kErr;

  const keeperIds = (keeperRows ?? []).map((k) => k.cleaner_id as string);
  if (keeperIds.length === 0) {
    throw new Error(`Booking ${bookingId} has no keepers in booking_cleaners`);
  }

  // 3. Compute total keeper earning (unchanged formula — transport excluded throughout)
  const cleaningFeeKobo    = (booking.base_amount_kobo as number) + (booking.addons_amount_kobo as number);
  const insuranceKobo      = booking.insurance_amount_kobo as number;
  const commissionKobo     = booking.commission_kobo as number;
  const cleaningCommission = commissionKobo - insuranceKobo;
  const totalEarningKobo   = cleaningFeeKobo - cleaningCommission; // ~78% of cleaning fee

  const refundKobo = (booking.refund_kobo as number) ?? 0;
  const totalKobo  = booking.total_amount_kobo as number;

  let earningPoolKobo = totalEarningKobo;
  let status: 'unpaid' | 'refunded' = 'unpaid';

  if (refundKobo >= totalKobo) {
    earningPoolKobo = 0;
    status = 'refunded';
  } else if (refundKobo > 0) {
    const keepFraction = 1 - refundKobo / totalKobo;
    earningPoolKobo = Math.max(0, Math.round(totalEarningKobo * keepFraction));
  }

  // 4. Split evenly; assign any remainder to the lead keeper (index 0) so the
  //    sum of all per-keeper rows equals earningPoolKobo exactly.
  const keeperCount   = keeperIds.length;
  const perKeeperKobo = Math.floor(earningPoolKobo / keeperCount);
  const remainderKobo = earningPoolKobo % keeperCount;

  const rows = keeperIds.map((cleanerId, i) => ({
    booking_id:   bookingId,
    cleaner_id:   cleanerId,
    earning_kobo: i === 0 ? perKeeperKobo + remainderKobo : perKeeperKobo,
    status,
  }));

  // 5. Upsert all rows in one call — idempotent on (booking_id, cleaner_id)
  const { error: insErr } = await supabase
    .from('cleaner_earnings')
    .upsert(rows, { onConflict: 'booking_id,cleaner_id', ignoreDuplicates: true });

  if (insErr) throw insErr;
}

/**
 * Called when a refund is confirmed for a booking.
 * Adjusts or cancels ALL earning rows for that booking (one per keeper).
 * Safe to call multiple times — idempotent if all rows already refunded.
 * Will NOT claw back earnings that are already paid (logs warning instead).
 */
export async function adjustEarningForRefund(
  bookingId: string,
  refundKobo: number,
  totalBookingKobo: number,
): Promise<void> {
  const { data: earningsData } = await supabase
    .from('cleaner_earnings')
    .select('id, earning_kobo, status')
    .eq('booking_id', bookingId);

  const earnings = (earningsData ?? []) as { id: string; earning_kobo: number; status: string }[];
  if (earnings.length === 0) return; // Not yet recorded — recordEarning will handle it

  if (earnings.some((e) => e.status === 'paid')) {
    console.warn(`[earnings] Refund for booking ${bookingId} but some earnings already paid — manual review needed`);
    return;
  }

  const toUpdate = earnings.filter((e) => e.status !== 'refunded');
  if (toUpdate.length === 0) return; // All already zeroed

  if (refundKobo >= totalBookingKobo) {
    // Full refund — zero all rows in one UPDATE
    await supabase
      .from('cleaner_earnings')
      .update({ status: 'refunded', earning_kobo: 0 })
      .eq('booking_id', bookingId)
      .in('status', ['unpaid', 'scheduled']);
  } else {
    // Partial refund — scale each keeper's share by the same keep-fraction
    const keepFraction = 1 - refundKobo / totalBookingKobo;
    for (const e of toUpdate) {
      const newEarning = Math.max(0, Math.round(e.earning_kobo * keepFraction));
      await supabase
        .from('cleaner_earnings')
        .update({ earning_kobo: newEarning })
        .eq('id', e.id);
    }
  }
}

/**
 * Returns per-cleaner aggregates of unpaid earnings + unsettled transport
 * reimbursements for the admin payout screen.
 *
 * unpaid_kobo          — cleaning-fee earnings not yet paid (from cleaner_earnings)
 * pending_transport_kobo — per-keeper transport owed where the booking's
 *                          transport_status is 'paid' and paid_out is still false
 *                          and no payout is already in flight (transport_payout_id IS NULL)
 *
 * The two are kept separate so the admin can see the breakdown; the payout
 * functions sum them when initiating a transfer.
 *
 * Excludes earnings with status 'refunded'.
 */
export async function getPendingPayoutSummary(): Promise<EarningSummary[]> {
  // ── Cleaning earnings ─────────────────────────────────────────────────────
  const { data: earnings, error: eErr } = await supabase
    .from('cleaner_earnings')
    .select('cleaner_id, earning_kobo')
    .eq('status', 'unpaid');

  if (eErr) throw eErr;

  const grouped: Record<string, { jobs: number; kobo: number }> = {};
  for (const e of earnings ?? []) {
    const cid = e.cleaner_id as string;
    if (!grouped[cid]) grouped[cid] = { jobs: 0, kobo: 0 };
    grouped[cid].jobs++;
    grouped[cid].kobo += e.earning_kobo as number;
  }

  // ── Per-keeper transport reimbursements ───────────────────────────────────
  // Eligible: not yet paid out, not already in-flight, a positive fare exists.
  const { data: transportRows, error: tErr } = await supabase
    .from('booking_cleaners')
    .select('cleaner_id, transport_fare_kobo, booking_id')
    .eq('paid_out', false)
    .is('transport_payout_id', null)
    .gt('transport_fare_kobo', 0);

  if (tErr) throw tErr;

  const transportMap: Record<string, number> = {};

  if (transportRows && transportRows.length > 0) {
    // Only include fares where the booking transport has actually been paid
    const bookingIds = [...new Set(transportRows.map((r) => r.booking_id as string))];
    const { data: paidBookings, error: pbErr } = await supabase
      .from('bookings')
      .select('id')
      .in('id', bookingIds)
      .eq('transport_status', 'paid');

    if (pbErr) throw pbErr;

    const paidIds = new Set((paidBookings ?? []).map((b) => b.id as string));
    for (const row of transportRows) {
      if (!paidIds.has(row.booking_id as string)) continue;
      const cid = row.cleaner_id as string;
      transportMap[cid] = (transportMap[cid] ?? 0) + (row.transport_fare_kobo as number);
    }
  }

  // ── Merge and fetch profiles ──────────────────────────────────────────────
  const cleanerIds = [...new Set([...Object.keys(grouped), ...Object.keys(transportMap)])];
  if (cleanerIds.length === 0) return [];

  const { data: cleaners, error: cErr } = await supabase
    .from('cleaners')
    .select('id, first_name, last_name, photo_url')
    .in('id', cleanerIds);

  if (cErr) throw cErr;

  const { data: accounts, error: aErr } = await supabase
    .from('cleaner_bank_accounts')
    .select('id, cleaner_id, bank_name, account_number, account_name')
    .in('cleaner_id', cleanerIds)
    .eq('is_primary', true);

  if (aErr) throw aErr;

  const accountMap: Record<string, (typeof accounts)[0]> = {};
  for (const a of accounts ?? []) {
    accountMap[a.cleaner_id as string] = a;
  }

  return (cleaners ?? []).map((c) => {
    const g  = grouped[c.id as string];
    const ba = accountMap[c.id as string];
    const transportKobo = transportMap[c.id as string] ?? 0;
    return {
      cleaner_id:             c.id as string,
      first_name:             c.first_name as string,
      last_name:              c.last_name as string,
      photo_url:              (c.photo_url as string | null) ?? null,
      unpaid_jobs:            g?.jobs ?? 0,
      unpaid_kobo:            g?.kobo ?? 0,
      pending_transport_kobo: transportKobo,
      has_bank_account:       !!ba,
      bank_account_id:        ba ? (ba.id as string) : null,
      bank_name:              ba ? (ba.bank_name as string) : null,
      account_number:         ba ? (ba.account_number as string) : null,
      account_name:           ba ? (ba.account_name as string) : null,
    };
  }).sort((a, b) =>
    (b.unpaid_kobo + b.pending_transport_kobo) - (a.unpaid_kobo + a.pending_transport_kobo),
  );
}

/**
 * Returns recent payout history for the admin payout screen.
 */
export async function getPayoutHistory(limit = 50): Promise<PayoutHistoryRow[]> {
  const { data, error } = await supabase
    .from('cleaner_payouts')
    .select(`
      id, cleaner_id, total_kobo, method, status, failure_reason,
      initiated_at, completed_at, created_at,
      cleaner:cleaners!cleaner_id(first_name, last_name),
      bank_account:cleaner_bank_accounts!bank_account_id(bank_name, account_number)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((r) => {
    const c = r.cleaner as unknown as { first_name: string; last_name: string } | null;
    const b = r.bank_account as unknown as { bank_name: string; account_number: string } | null;
    return {
      id:                  r.id as string,
      cleaner_id:          r.cleaner_id as string,
      cleaner_first_name:  c?.first_name ?? '—',
      cleaner_last_name:   c?.last_name  ?? '',
      total_kobo:          r.total_kobo as number,
      method:              r.method as string,
      status:              r.status as string,
      failure_reason:      (r.failure_reason as string | null) ?? null,
      initiated_at:        (r.initiated_at as string | null) ?? null,
      completed_at:        (r.completed_at as string | null) ?? null,
      created_at:          r.created_at as string,
      bank_name:           b?.bank_name      ?? null,
      account_number:      b?.account_number ?? null,
    };
  });
}
