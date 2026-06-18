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
  bookingDate: string;   // pre-formatted, e.g. "Tuesday, 1 July"
  address: string;
  totalAmountNgn: number;
}

// Sent to the customer after payment is confirmed.
export function customerConfirmedMsg(ctx: BookingNotifContext): string {
  return (
    `Hi ${ctx.customerFirstName}, your Klova booking is confirmed! ` +
    `${ctx.cleanerFirstName} ${ctx.cleanerLastName} will be with you on ${ctx.bookingDate} ` +
    `for a ${ctx.serviceName}. ` +
    `Address: ${ctx.address}. ` +
    `Questions? WhatsApp us on +234 800 000 0000.`
  );
}

// Sent to the cleaner when a booking is confirmed (payment received).
export function cleanerAssignedMsg(ctx: BookingNotifContext): string {
  return (
    `Hi ${ctx.cleanerFirstName}, new Klova job! ` +
    `${ctx.serviceName} for ${ctx.customerFirstName} on ${ctx.bookingDate}. ` +
    `Address: ${ctx.address}. ` +
    `Customer: ${ctx.customerPhone}. ` +
    `Check the app for full details.`
  );
}

// Sent to the admin phone for every confirmed paid booking.
export function adminConfirmedMsg(ctx: BookingNotifContext): string {
  return (
    `[Klova] Booking confirmed. ` +
    `ID: ${ctx.bookingId.slice(0, 8)}. ` +
    `Customer: ${ctx.customerFirstName} ${ctx.customerLastName} (${ctx.customerPhone}). ` +
    `Cleaner: ${ctx.cleanerFirstName} ${ctx.cleanerLastName}. ` +
    `Service: ${ctx.serviceName} on ${ctx.bookingDate}. ` +
    `Amount: ₦${ctx.totalAmountNgn.toLocaleString('en-NG')}.`
  );
}
