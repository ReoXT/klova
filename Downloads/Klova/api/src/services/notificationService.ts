import { supabase } from '../lib/supabase';
import { config } from '../config';
import { sendSms, sendWhatsApp } from '../lib/termiiClient';
import {
  BookingNotifContext,
  adminPaidBookingMsg,
  cleanerNewJobMsg,
  customerDispatchConfirmedMsg,
} from '../lib/messageTemplates';

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchNotifContext(bookingId: string): Promise<BookingNotifContext | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      booking_date,
      address,
      total_amount_kobo,
      customers:customer_id (first_name, last_name, phone),
      cleaners:cleaner_id (first_name, last_name, phone),
      services:service_id (name),
      zones:zone_id (name)
    `)
    .eq('id', bookingId)
    .single();

  if (error || !data) {
    console.error(`[notify] Could not fetch booking ${bookingId}:`, error?.message);
    return null;
  }

  // Supabase infers relationship results as arrays without generated types — cast via unknown.
  const customer = data.customers as unknown as { first_name: string; last_name: string; phone: string } | null;
  const cleaner  = data.cleaners  as unknown as { first_name: string; last_name: string; phone: string } | null;
  const service  = data.services  as unknown as { name: string } | null;
  const zone     = data.zones     as unknown as { name: string } | null;

  if (!customer || !cleaner || !service || !zone) {
    console.error(`[notify] Booking ${bookingId} missing related row (customer/cleaner/service/zone)`);
    return null;
  }

  return {
    bookingId: data.id as string,
    customerFirstName: customer.first_name,
    customerLastName:  customer.last_name,
    customerPhone:     customer.phone,
    cleanerFirstName:  cleaner.first_name,
    cleanerLastName:   cleaner.last_name,
    cleanerPhone:      cleaner.phone,
    serviceName:       service.name,
    zoneName:          zone.name,
    bookingDate:       formatDate(data.booking_date as string),
    address:           data.address as string,
    totalAmountNgn:    Math.round((data.total_amount_kobo as number) / 100),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  // "2026-07-01" → "Tuesday, 1 July"
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('en-NG', {
    timeZone: 'Africa/Lagos',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// Wraps every send so a Termii error never crashes the booking flow.
async function safeSend(
  fn: () => Promise<void>,
  label: string,
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[notify] ${label} failed:`, err instanceof Error ? err.message : err);
  }
}

// ─── Triggers ─────────────────────────────────────────────────────────────────

// Fires on payment confirmation (Paystack webhook → confirmed).
// Notifies admin with full booking + cleaner details so they can call to confirm dispatch.
export async function notifyAdminPaidBooking(bookingId: string): Promise<void> {
  const ctx = await fetchNotifContext(bookingId);
  if (!ctx) return;

  if (!config.adminPhone) {
    console.log(`[notify] ADMIN_PHONE not set — skipping admin SMS for booking ${bookingId}`);
    return;
  }

  await safeSend(
    () => sendSms(config.adminPhone!, adminPaidBookingMsg(ctx)),
    'admin-paid-booking',
  );
}

// Fires on payment confirmation (Paystack webhook → confirmed).
// Sends to cleaner via both WhatsApp and SMS — WhatsApp first, then SMS regardless.
export async function notifyCleanerNewJob(bookingId: string): Promise<void> {
  const ctx = await fetchNotifContext(bookingId);
  if (!ctx) return;

  const msg = cleanerNewJobMsg(ctx);

  await safeSend(() => sendWhatsApp(ctx.cleanerPhone, msg), 'cleaner-whatsapp');
  await safeSend(() => sendSms(ctx.cleanerPhone, msg),      'cleaner-sms');
}

// Reserved for the admin panel — fires when admin manually confirms cleaner dispatch.
// Not called from the Paystack webhook. The admin contacts the customer directly for V1.
export async function notifyCustomerDispatchConfirmed(bookingId: string): Promise<void> {
  const ctx = await fetchNotifContext(bookingId);
  if (!ctx) return;

  await safeSend(
    () => sendSms(ctx.customerPhone, customerDispatchConfirmedMsg(ctx)),
    'customer-dispatch-confirmed',
  );
}
