import { supabase } from '../lib/supabase';

export interface EarningSummary {
  cleaner_id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  unpaid_jobs: number;
  unpaid_kobo: number;
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
 * Inserts a cleaner_earnings row = 78% of the cleaning fee.
 * Idempotent: the UNIQUE constraint on booking_id prevents double-inserts.
 */
export async function recordEarning(bookingId: string): Promise<void> {
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('cleaner_id, base_amount_kobo, addons_amount_kobo, insurance_amount_kobo, commission_kobo')
    .eq('id', bookingId)
    .eq('status', 'completed')
    .single();

  if (bErr || !booking) {
    throw bErr ?? new Error(`Booking ${bookingId} not found or not completed`);
  }

  if (!booking.cleaner_id) {
    throw new Error(`Booking ${bookingId} has no cleaner assigned`);
  }

  const cleaningFeeKobo = (booking.base_amount_kobo as number) + (booking.addons_amount_kobo as number);
  // commission_kobo = round(cleaningFee × 0.22) + insurance; so cleaning commission alone is:
  const insuranceKobo       = booking.insurance_amount_kobo as number;
  const commissionKobo      = booking.commission_kobo as number;
  const cleaningCommission  = commissionKobo - insuranceKobo;
  const earningKobo         = cleaningFeeKobo - cleaningCommission; // = 78% of cleaning fee

  const { error: insErr } = await supabase
    .from('cleaner_earnings')
    .upsert(
      {
        booking_id:   bookingId,
        cleaner_id:   booking.cleaner_id as string,
        earning_kobo: earningKobo,
        status:       'unpaid',
      },
      { onConflict: 'booking_id', ignoreDuplicates: true },
    );

  if (insErr) throw insErr;
}

/**
 * Returns per-cleaner aggregates of unpaid earnings for the admin payout screen.
 */
export async function getPendingPayoutSummary(): Promise<EarningSummary[]> {
  // Fetch all unpaid earnings
  const { data: earnings, error: eErr } = await supabase
    .from('cleaner_earnings')
    .select('cleaner_id, earning_kobo')
    .eq('status', 'unpaid');

  if (eErr) throw eErr;
  if (!earnings || earnings.length === 0) return [];

  // Group by cleaner
  const grouped: Record<string, { jobs: number; kobo: number }> = {};
  for (const e of earnings) {
    const cid = e.cleaner_id as string;
    if (!grouped[cid]) grouped[cid] = { jobs: 0, kobo: 0 };
    grouped[cid].jobs++;
    grouped[cid].kobo += e.earning_kobo as number;
  }

  const cleanerIds = Object.keys(grouped);

  // Fetch cleaner profiles
  const { data: cleaners, error: cErr } = await supabase
    .from('cleaners')
    .select('id, first_name, last_name, photo_url')
    .in('id', cleanerIds);

  if (cErr) throw cErr;

  // Fetch primary bank accounts
  const { data: accounts, error: aErr } = await supabase
    .from('cleaner_bank_accounts')
    .select('id, cleaner_id, bank_name, account_number, account_name')
    .in('cleaner_id', cleanerIds)
    .eq('is_primary', true);

  if (aErr) throw aErr;

  const accountMap: Record<string, typeof accounts[0]> = {};
  for (const a of accounts ?? []) {
    accountMap[a.cleaner_id as string] = a;
  }

  return (cleaners ?? []).map((c) => {
    const g  = grouped[c.id as string];
    const ba = accountMap[c.id as string];
    return {
      cleaner_id:       c.id as string,
      first_name:       c.first_name as string,
      last_name:        c.last_name as string,
      photo_url:        (c.photo_url as string | null) ?? null,
      unpaid_jobs:      g.jobs,
      unpaid_kobo:      g.kobo,
      has_bank_account: !!ba,
      bank_account_id:  ba ? (ba.id as string) : null,
      bank_name:        ba ? (ba.bank_name as string) : null,
      account_number:   ba ? (ba.account_number as string) : null,
      account_name:     ba ? (ba.account_name as string) : null,
    };
  }).sort((a, b) => b.unpaid_kobo - a.unpaid_kobo);
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
