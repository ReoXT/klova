// All notification message templates live here. Edit copy in one place.

export interface BookingNotifContext {
  bookingId: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  cleanerFirstName: string;
  cleanerLastName: string;
  cleanerPhone: string;
  cleanerEmail: string | null;
  serviceName: string;
  zoneName: string;
  bookingDate: string;   // pre-formatted, e.g. "Tuesday, 1 July"
  address: string;
  totalAmountNgn: number;
}

// ─── Admin ────────────────────────────────────────────────────────────────────
// Fires on payment confirmation. Roadmap wording verbatim, plus cleaner phone
// so you can call to confirm dispatch without opening Supabase.

export function adminPaidBookingMsg(ctx: BookingNotifContext): string {
  return (
    `New paid booking: ${ctx.serviceName}, ${ctx.zoneName}, ${ctx.bookingDate}. ` +
    `Customer: ${ctx.customerFirstName} ${ctx.customerLastName} (${ctx.customerPhone}). ` +
    `Auto-matched: ${ctx.cleanerFirstName} ${ctx.cleanerLastName} (${ctx.cleanerPhone}). ` +
    `Confirm with cleaner.`
  );
}

// ─── Cleaner ─────────────────────────────────────────────────────────────────
// Fires on payment confirmation via both SMS and WhatsApp.

export function cleanerNewJobMsg(ctx: BookingNotifContext): string {
  return (
    `Hi ${ctx.cleanerFirstName}! New Klova job.\n` +
    `Service: ${ctx.serviceName}\n` +
    `Date: ${ctx.bookingDate}\n` +
    `Address: ${ctx.address}\n` +
    `Customer: ${ctx.customerFirstName} (${ctx.customerPhone})\n` +
    `Amount: ₦${ctx.totalAmountNgn.toLocaleString('en-NG')}\n` +
    `Please confirm availability with admin.`
  );
}

// ─── Admin: transport paid ─────────────────────────────────────────────────────
// Fires when the customer pays the Paystack transport Payment Request.
// Short enough for a quick glance; full details are in the dashboard.

export function adminTransportPaidMsg(
  bookingId: string,
  fareNgn: number,
  customerName: string,
  bookingDate: string,
): string {
  return (
    `Transport paid, booking ${bookingId.slice(0, 8).toUpperCase()}. ` +
    `₦${fareNgn.toLocaleString('en-NG')} received. ` +
    `Customer: ${customerName}. Date: ${bookingDate}. ` +
    `Confirm dispatch when ready.`
  );
}

// ─── Keeper: job cancelled (transport not paid) ────────────────────────────────
// Fires when admin cancels a booking because the customer never paid transport.
// The Keeper's date is freed at the same time this message is sent.

export function keeperJobCancelledMsg(ctx: BookingNotifContext): string {
  return (
    `Hi ${ctx.cleanerFirstName}, unfortunately the ${ctx.bookingDate} job has been cancelled. ` +
    `The customer did not complete their transport payment. ` +
    `Your date has been freed, you'll receive a new booking soon.`
  );
}

// ─── Keeper: dispatch confirmed ─────────────────────────────────────────────────
// Fires when admin hits confirm-dispatch. Transport is already settled by this point.
// Distinct from cleanerNewJobMsg (which fires on clean-payment): this is the "go now".

export function keeperDispatchedMsg(ctx: BookingNotifContext): string {
  return (
    `Hi ${ctx.cleanerFirstName}! You're confirmed to go for today's Klova job.\n` +
    `Service: ${ctx.serviceName}\n` +
    `Date: ${ctx.bookingDate}\n` +
    `Address: ${ctx.address}\n` +
    `Customer: ${ctx.customerFirstName} ${ctx.customerLastName} (${ctx.customerPhone})\n` +
    `Head out on time, the customer has been notified you're coming.`
  );
}

// ─── Customer ─────────────────────────────────────────────────────────────────
// Reserved for when the admin panel can trigger dispatch confirmation.
// Not sent automatically. Admin contacts the customer manually for V1.

export function customerDispatchConfirmedMsg(
  ctx: BookingNotifContext,
  allKeeperFirstNames?: string[],
): string {
  const keeperPhrase =
    allKeeperFirstNames && allKeeperFirstNames.length > 1
      ? allKeeperFirstNames.join(' and ')
      : ctx.cleanerFirstName;
  return (
    `Hi ${ctx.customerFirstName}! Your Klova booking is confirmed. ` +
    `${keeperPhrase} will be with you on ${ctx.bookingDate} for your ${ctx.serviceName}. ` +
    `Questions? WhatsApp us on +234 800 000 0000.`
  );
}
