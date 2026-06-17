import { supabase } from '../lib/supabase';
import { computePrice, ValidationError } from './pricingService';

// ─── Error types ─────────────────────────────────────────────────────────────

export class FieldValidationError extends Error {
  readonly status = 400;
  readonly fields: Record<string, string>;
  constructor(fields: Record<string, string>) {
    super('Validation failed');
    this.name = 'FieldValidationError';
    this.fields = fields;
  }
}

// ─── Input types ─────────────────────────────────────────────────────────────

export interface BookingInput {
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  address: string;
  zone_slug: string;
  service_slug: string;
  bedrooms: string;
  addon_slugs: string[];
  booking_date: string; // YYYY-MM-DD
  requested_cleaner_id?: string;
}

export interface BookingResult {
  booking_id: string;
  total_amount: number;      // NGN
  commission_amount: number; // NGN
  commission_rate: number;
}

// ─── Validation ──────────────────────────────────────────────────────────────

const REQUIRED = [
  'first_name',
  'last_name',
  'phone',
  'address',
  'zone_slug',
  'service_slug',
  'bedrooms',
  'booking_date',
] as const;

/**
 * Pure synchronous validation — no DB calls.
 * Throws FieldValidationError with every field error at once.
 */
export function validateBookingInput(body: Record<string, unknown>): BookingInput {
  const errors: Record<string, string> = {};

  for (const field of REQUIRED) {
    const val = body[field];
    if (!val || typeof val !== 'string' || !val.trim()) {
      errors[field] = `${field.replace(/_/g, ' ')} is required.`;
    }
  }

  // Date validation (only when the field itself was supplied)
  if (!errors.booking_date && typeof body.booking_date === 'string') {
    const parsed = new Date(body.booking_date);
    if (isNaN(parsed.getTime())) {
      errors.booking_date = 'Booking date is invalid. Use YYYY-MM-DD format.';
    } else {
      // Midnight UTC today — bookings must be for today or later
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      if (parsed < today) {
        errors.booking_date = 'Booking date cannot be in the past.';
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new FieldValidationError(errors);
  }

  return {
    first_name: (body.first_name as string).trim(),
    last_name: (body.last_name as string).trim(),
    phone: (body.phone as string).trim(),
    email: typeof body.email === 'string' && body.email.trim() ? body.email.trim() : undefined,
    address: (body.address as string).trim(),
    zone_slug: (body.zone_slug as string).trim(),
    service_slug: (body.service_slug as string).trim(),
    bedrooms: (body.bedrooms as string).trim(),
    addon_slugs: Array.isArray(body.addon_slugs)
      ? (body.addon_slugs as unknown[]).filter((s): s is string => typeof s === 'string')
      : [],
    booking_date: (body.booking_date as string).trim(),
    requested_cleaner_id:
      typeof body.requested_cleaner_id === 'string' && body.requested_cleaner_id.trim()
        ? body.requested_cleaner_id.trim()
        : undefined,
  };
}

// ─── Core booking logic ───────────────────────────────────────────────────────

export async function createBooking(input: BookingInput): Promise<BookingResult> {
  // 1. Validate zone is active
  const { data: zone } = await supabase
    .from('zones')
    .select('id, is_active')
    .eq('slug', input.zone_slug)
    .single();

  if (!zone) {
    throw new FieldValidationError({ zone_slug: `Unknown zone "${input.zone_slug}".` });
  }
  if (!zone.is_active) {
    throw new FieldValidationError({
      zone_slug: `"${input.zone_slug}" is not yet available for bookings. Check our zones page for live areas.`,
    });
  }

  // 2. Compute price server-side — also validates service, bedrooms, add-ons
  //    Re-wrap ValidationError as a field error so the response shape is consistent
  let breakdown;
  try {
    breakdown = await computePrice(input.service_slug, input.bedrooms, input.addon_slugs);
  } catch (err) {
    if (err instanceof ValidationError) {
      const msg = err.message;
      if (msg.startsWith('Unknown service')) throw new FieldValidationError({ service_slug: msg });
      if (msg.startsWith('Invalid apartment size')) throw new FieldValidationError({ bedrooms: msg });
      if (msg.startsWith('Unknown add-on')) throw new FieldValidationError({ addon_slugs: msg });
    }
    throw err;
  }

  // 3. Find or create customer — upsert on phone (unique key)
  const { data: customer, error: customerErr } = await supabase
    .from('customers')
    .upsert(
      {
        first_name: input.first_name,
        last_name: input.last_name,
        phone: input.phone,
        email: input.email ?? null,
      },
      { onConflict: 'phone' },
    )
    .select('id')
    .single();

  if (customerErr || !customer) {
    throw customerErr ?? new Error('Failed to create customer record.');
  }

  // 4. Insert booking row (no cleaner, no payment yet)
  const totalKobo = Math.round(breakdown.total_amount * 100);
  const commissionKobo = Math.round(breakdown.commission_amount * 100);

  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .insert({
      customer_id: customer.id,
      zone_id: zone.id,
      service_id: breakdown.service_id,
      bedrooms: input.bedrooms,
      booking_date: input.booking_date,
      address: input.address,
      total_amount_kobo: totalKobo,
      commission_kobo: commissionKobo,
      requested_cleaner_id: input.requested_cleaner_id ?? null,
      status: 'pending_payment',
    })
    .select('id')
    .single();

  if (bookingErr || !booking) {
    throw bookingErr ?? new Error('Failed to create booking.');
  }

  // 5. Link any add-ons
  if (breakdown.addon_ids.length > 0) {
    const { error: addonErr } = await supabase.from('booking_addons').insert(
      breakdown.addon_ids.map((addon_id) => ({ booking_id: booking.id, addon_id })),
    );
    if (addonErr) throw addonErr;
  }

  return {
    booking_id: booking.id,
    total_amount: breakdown.total_amount,
    commission_amount: breakdown.commission_amount,
    commission_rate: breakdown.commission_rate,
  };
}
