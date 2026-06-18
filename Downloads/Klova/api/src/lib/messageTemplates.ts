// All notification message templates live here — edit copy in one place.

export interface BookingNotifContext {
  bookingId: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  cleanerFirstName: string;
  cleanerLastName: string;
  cleanerPhone: string;
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

// ─── Customer ─────────────────────────────────────────────────────────────────
// Reserved for when the admin panel can trigger dispatch confirmation.
// Not sent automatically — admin contacts the customer manually for V1.

export function customerDispatchConfirmedMsg(ctx: BookingNotifContext): string {
  return (
    `Hi ${ctx.customerFirstName}! Your Klova booking is confirmed. ` +
    `${ctx.cleanerFirstName} will be with you on ${ctx.bookingDate} for your ${ctx.serviceName}. ` +
    `Questions? WhatsApp us on +234 800 000 0000.`
  );
}
