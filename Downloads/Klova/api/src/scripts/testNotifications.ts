// Fires the admin + cleaner notifications for a real booking ID.
// Usage:
//   cd api
//   BOOKING_ID=<uuid> tsx src/scripts/testNotifications.ts
//
// Reads SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TERMII_API_KEY,
// TERMII_SENDER_ID, and ADMIN_PHONE from the .env file automatically.

import 'dotenv/config';
import { notifyAdminPaidBooking, notifyCleanerNewJob } from '../services/notificationService';

void (async () => {
  const bookingId = process.env.BOOKING_ID;
  if (!bookingId) {
    console.error('Set BOOKING_ID=<uuid> before running this script.');
    process.exit(1);
  }

  console.log(`Firing notifications for booking ${bookingId} …\n`);

  await notifyAdminPaidBooking(bookingId);
  console.log('✓ Admin notification sent');

  await notifyCleanerNewJob(bookingId);
  console.log('✓ Cleaner notifications sent (WhatsApp + SMS)');

  console.log('\nDone. Check your phone and the cleaner number for messages.');
})();
