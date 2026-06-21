import { supabase } from '../lib/supabase';
import { computePrice, ValidationError } from './pricingService';
import { assignCleaner } from './assignmentService';

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

export class NoAvailabilityError extends Error {
  readonly status = 409;
  constructor(zoneSlug: string, date: string) {
    super(`No cleaners available in ${zoneSlug} on ${date}. Try a different date.`);
    this.name = 'NoAvailabilityError';
  }
}

// ─── Input / output types ─────────────────────────────────────────────────────

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
  time_slot?: string | null;
  keeper_count?: number;
  wants_insurance?: boolean;
  requested_cleaner_id?: string;
}

export interface CleanerProfile {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  rating: number | null;
  total_jobs: number;
}

export interface BookingResult {
  booking_id: string;
  total_amount: number;      // NGN
  commission_amount: number; // NGN
  commission_rate: number;
  cleaners: CleanerProfile[];
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

  // Phone format — accepts 0XXXXXXXXXX, +234XXXXXXXXX, 234XXXXXXXXX (Nigerian mobile)
  if (!errors.phone && typeof body.phone === 'string') {
    const normalized = (body.phone as string).replace(/\s/g, '');
    if (!/^(\+?234|0)[789]\d{9}$/.test(normalized)) {
      errors.phone = 'Enter a valid Nigerian mobile number (e.g. 08012345678 or +2348012345678).';
    }
  }

  // Address length cap
  if (!errors.address && typeof body.address === 'string' && body.address.trim().length > 500) {
    errors.address = 'Address must be 500 characters or fewer.';
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
    time_slot: typeof body.time_slot === 'string' && body.time_slot.trim() ? body.time_slot.trim() : null,
    keeper_count:
      typeof body.keeper_count === 'number' && body.keeper_count >= 1
        ? Math.round(body.keeper_count)
        : undefined,
    wants_insurance: body.wants_insurance === true,
    requested_cleaner_id:
      typeof body.requested_cleaner_id === 'string' && body.requested_cleaner_id.trim()
        ? body.requested_cleaner_id.trim()
        : undefined,
  };
}

// ─── Core booking logic ───────────────────────────────────────────────────────

export async function createBooking(input: BookingInput): Promise<BookingResult> {
  console.log(`[booking] Creating: ${input.service_slug} ${input.bedrooms}bd for ${input.phone} on ${input.booking_date}`);

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
  let breakdown;
  try {
    breakdown = await computePrice(input.service_slug, input.bedrooms, input.addon_slugs, {
      keeperCount: input.keeper_count,
      wantsInsurance: input.wants_insurance,
    });
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

  // 4. Insert booking row at pending_payment — assignment runs next
  const baseKobo         = Math.round(breakdown.base_amount * 100);
  const addonsKobo       = Math.round(breakdown.addons_amount * 100);
  const insuranceKobo    = Math.round(breakdown.insurance_amount * 100);
  const totalKobo        = Math.round(breakdown.total_amount * 100);
  const commissionKobo   = Math.round(breakdown.commission_amount * 100);

  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .insert({
      customer_id:          customer.id,
      zone_id:              zone.id,
      service_id:           breakdown.service_id,
      bedrooms:             input.bedrooms,
      booking_date:         input.booking_date,
      time_slot:            input.time_slot ?? null,
      address:              input.address,
      base_amount_kobo:     baseKobo,
      addons_amount_kobo:   addonsKobo,
      insurance_amount_kobo: insuranceKobo,
      total_amount_kobo:    totalKobo,
      commission_kobo:      commissionKobo,
      requested_cleaner_id: input.requested_cleaner_id ?? null,
      status:               'pending_payment',
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

  console.log(`[booking] ${booking.id}: row created — assigning cleaner`);

  // 6. Assign cleaner(s) immediately — customer sees who's coming before paying
  const assignment = await assignCleaner(booking.id, {
    zone_id: zone.id,
    customer_id: customer.id,
    booking_date: input.booking_date,
    requested_cleaner_id: input.requested_cleaner_id ?? null,
    keeper_count: input.keeper_count ?? 1,
  });

  if (assignment.outcome === 'no_match') {
    console.warn(`[booking] ${booking.id}: no match in ${input.zone_slug} on ${input.booking_date}`);
    throw new NoAvailabilityError(input.zone_slug, input.booking_date);
  }

  console.log(`[booking] ${booking.id}: matched ${assignment.cleanerIds.length} keeper(s) — ${assignment.cleanerIds.join(', ')}`);

  // 7. Fetch all assigned keeper profiles to return to the frontend
  const { data: cleanerRows, error: cleanerErr } = await supabase
    .from('cleaners')
    .select('id, first_name, last_name, photo_url, rating, total_jobs')
    .in('id', assignment.cleanerIds);

  if (cleanerErr) throw cleanerErr;

  // Preserve assignment order (lead first, second second)
  const cleanerMap = new Map(
    (cleanerRows ?? []).map((c) => [c.id as string, c]),
  );

  const cleaners: CleanerProfile[] = assignment.cleanerIds.map((cid) => {
    const c = cleanerMap.get(cid);
    if (!c) throw new Error(`Failed to load profile for keeper ${cid}.`);
    return {
      id: c.id as string,
      first_name: c.first_name as string,
      last_name: c.last_name as string,
      photo_url: (c.photo_url as string | null) ?? null,
      rating: (c.rating as number | null) ?? null,
      total_jobs: c.total_jobs as number,
    };
  });

  return {
    booking_id: booking.id,
    total_amount: breakdown.total_amount,
    commission_amount: breakdown.commission_amount,
    commission_rate: breakdown.commission_rate,
    cleaners,
  };
}
