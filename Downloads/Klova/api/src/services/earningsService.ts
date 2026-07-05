import { supabase } from '../lib/supabase';

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

  // 5. Log and verify the split before writing (2-keeper bookings only)
  if (keeperCount > 1) {
    const sumKobo = rows.reduce((s, r) => s + r.earning_kobo, 0);
    if (sumKobo !== earningPoolKobo) {
      console.error(
        `[earnings] SPLIT BUG: booking ${bookingId}, pool ${earningPoolKobo} kobo, ` +
        `sum of ${keeperCount} rows = ${sumKobo} — off by ${sumKobo - earningPoolKobo}. ` +
        `Investigate immediately.`,
      );
    } else {
      console.log(
        `[earnings] Booking ${bookingId}: ${keeperCount} keepers, ` +
        `pool ₦${(earningPoolKobo / 100).toFixed(2)}, ` +
        `split: ${rows.map((r) => `₦${(r.earning_kobo / 100).toFixed(2)}`).join(' + ')}`,
      );
    }
  }

  // 6. Upsert all rows in one call — idempotent on (booking_id, cleaner_id)
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
