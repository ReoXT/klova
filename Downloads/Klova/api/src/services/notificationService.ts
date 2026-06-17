// Stub — wire to Termii SMS/WhatsApp in Section 5.

export async function notifyCustomerAssigned(bookingId: string): Promise<void> {
  console.log(`[notify] Customer: cleaner assigned for booking ${bookingId}`);
}

export async function notifyAdminAssigned(bookingId: string): Promise<void> {
  console.log(`[notify] Admin: booking ${bookingId} matched successfully`);
}

export async function notifyAdminNoMatch(bookingId: string): Promise<void> {
  console.log(`[notify] Admin: no cleaner available for booking ${bookingId} — refund queued`);
}
