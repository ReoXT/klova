// Projects a keeper's share of a booking's cleaning fee before the booking
// has completed (cleaner_earnings rows only get written by recordEarning()
// in api/src/services/earningsService.ts once status flips to 'completed').
// This mirrors that exact formula so the preview shown for upcoming/today
// jobs matches what will actually be recorded, including even/lead-remainder
// splits for two-keeper bookings and partial-refund adjustment.
export interface BookingFinancials {
  base_amount_kobo: number;
  addons_amount_kobo: number;
  insurance_amount_kobo: number;
  commission_kobo: number;
  total_amount_kobo: number;
  refund_kobo: number;
}

export function projectKeeperEarningKobo(
  booking: BookingFinancials,
  keeperCount: number,
  myRole: "lead" | "second",
): number {
  const cleaningFeeKobo    = booking.base_amount_kobo + booking.addons_amount_kobo;
  const cleaningCommission = booking.commission_kobo - booking.insurance_amount_kobo;
  const totalEarningKobo   = cleaningFeeKobo - cleaningCommission;

  const refundKobo = booking.refund_kobo ?? 0;
  const totalKobo  = booking.total_amount_kobo;

  let earningPoolKobo = totalEarningKobo;
  if (refundKobo >= totalKobo) {
    earningPoolKobo = 0;
  } else if (refundKobo > 0) {
    const keepFraction = 1 - refundKobo / totalKobo;
    earningPoolKobo = Math.max(0, Math.round(totalEarningKobo * keepFraction));
  }

  const perKeeperKobo = Math.floor(earningPoolKobo / keeperCount);
  const remainderKobo = earningPoolKobo % keeperCount;

  return myRole === "lead" ? perKeeperKobo + remainderKobo : perKeeperKobo;
}
