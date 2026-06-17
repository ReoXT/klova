// Stub — wire to Termii SMS/WhatsApp in Section 5.

export async function notifyCustomerConfirmed(bookingId: string): Promise<void> {
  console.log(`[notify] Customer: booking ${bookingId} confirmed — payment received`);
}

export async function notifyCleanerAssigned(bookingId: string): Promise<void> {
  console.log(`[notify] Cleaner: you have a new booking ${bookingId} — start preparing`);
}

export async function notifyAdminConfirmed(bookingId: string): Promise<void> {
  console.log(`[notify] Admin: booking ${bookingId} confirmed and paid`);
}
