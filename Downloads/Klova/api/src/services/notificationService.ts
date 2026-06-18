import { supabase } from '../lib/supabase';
import { config } from '../config';
import { sendSms } from '../lib/termiiClient';
import {
  BookingNotifContext,
  customerConfirmedMsg,
  cleanerAssignedMsg,
  adminConfirmedMsg,
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
      services:service_id (name)
    `)
    .eq('id', bookingId)
    .single();

  if (error || !data) {
    console.error(`[notify] Could not fetch booking ${bookingId}:`, error?.message);
    return null;
  }

  // Supabase infers relationship results as arrays without generated types — cast via unknown.
  const customer = data.customers as unknown as { first_name: string; last_name: string; phone: string } | null;
  const cleaner = data.cleaners as unknown as { first_name: string; last_name: string; phone: string } | null;
  const service = data.services as unknown as { name: string } | null;

  if (!customer || !cleaner || !service) {
    console.error(`[notify] Booking ${bookingId} missing customer, cleaner, or service row`);
    return null;
  }

  return {
    bookingId: data.id as string,
    customerFirstName: customer.first_name,
    customerLastName: customer.last_name,
    customerPhone: customer.phone,
    cleanerFirstName: cleaner.first_name,
    cleanerLastName: cleaner.last_name,
    cleanerPhone: cleaner.phone,
    serviceName: service.name,
    bookingDate: formatDate(data.booking_date as string),
    address: data.address as string,
    totalAmountNgn: Math.round((data.total_amount_kobo as number) / 100),
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

// Wrap every SMS dispatch so a Termii error never crashes the booking flow.
async function safeSend(to: string, message: string, label: string): Promise<void> {
  try {
    await sendSms(to, message);
  } catch (err) {
    console.error(`[notify] SMS failed (${label}):`, err instanceof Error ? err.message : err);
  }
}

// ─── Public notification functions ────────────────────────────────────────────

export async function notifyCustomerConfirmed(bookingId: string): Promise<void> {
  const ctx = await fetchNotifContext(bookingId);
  if (!ctx) return;
  await safeSend(ctx.customerPhone, customerConfirmedMsg(ctx), 'customer-confirmed');
}

export async function notifyCleanerAssigned(bookingId: string): Promise<void> {
  const ctx = await fetchNotifContext(bookingId);
  if (!ctx) return;
  await safeSend(ctx.cleanerPhone, cleanerAssignedMsg(ctx), 'cleaner-assigned');
}

export async function notifyAdminConfirmed(bookingId: string): Promise<void> {
  const ctx = await fetchNotifContext(bookingId);
  if (!ctx) return;
  if (!config.adminPhone) {
    console.log(`[notify] ADMIN_PHONE not set — skipping admin SMS for booking ${bookingId}`);
    return;
  }
  await safeSend(config.adminPhone, adminConfirmedMsg(ctx), 'admin-confirmed');
}
