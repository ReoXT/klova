import { supabase } from '../lib/supabase';
import { computePrice, ValidationError } from './pricingService';
import { assignCleaner } from './assignmentService';
import { matchCleaner, NO_MATCH } from './matchingService';
import { getAlternativeDates } from './availabilityService';

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

/**
 * Thrown when a 2-keeper booking is requested but the zone only has 1 free
 * cleaner on that date.  Carries two recovery options so the frontend can act:
 *   single_keeper_option — server-recomputed price at keeper_count=1
 *   alternative_dates    — nearby dates where ≥2 cleaners are free
 */
export class PartialAvailabilityError extends Error {
  readonly status = 409;
  readonly outcome = 'partial_availability' as const;
  constructor(
    public readonly single_keeper_price: {
      total_amount: number;
      commission_amount: number;
      commission_rate: number;
    },
    public readonly alternative_dates: string[],
  ) {
    super('Only 1 keeper is available on this date. Choose 1 keeper or pick a different date.');
    this.name = 'PartialAvailabilityError';
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
  latitude?: number | null;
  longitude?: number | null;
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

  // keeper_count must be 1 or 2 — reject anything else to avoid silent mis-pricing
  if (body.keeper_count != null) {
    const kc = Number(body.keeper_count);
    if (!Number.isInteger(kc) || kc < 1 || kc > 2) {
      errors.keeper_count = 'keeper_count must be 1 or 2.';
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
      typeof body.keeper_count === 'number' && body.keeper_count >= 1 && body.keeper_count <= 2
        ? Math.round(body.keeper_count)
        : undefined,
    wants_insurance: body.wants_insurance === true,
    requested_cleaner_id:
      typeof body.requested_cleaner_id === 'string' && body.requested_cleaner_id.trim()
        ? body.requested_cleaner_id.trim()
        : undefined,
    latitude:  typeof body.latitude  === 'number' && isFinite(body.latitude)  ? body.latitude  : null,
    longitude: typeof body.longitude === 'number' && isFinite(body.longitude) ? body.longitude : null,
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

  // 3b. Pre-flight: 2-keeper bookings need at least 2 free cleaners on this date.
  //     Run matchCleaner here (before the booking INSERT) so we never create an
  //     orphaned pending_payment row just to immediately mark it no_match.
  const keeperCount = input.keeper_count ?? 1;
  if (keeperCount === 2) {
    const preCandidates = await matchCleaner({
      zone_id: zone.id,
      customer_id: customer.id,
      booking_date: input.booking_date,
      requested_cleaner_id: input.requested_cleaner_id ?? null,
      keeper_count: 2,
    });

    if (preCandidates !== NO_MATCH && preCandidates.length < 2) {
      // Zone has cleaners but only 1 is free on this date — offer two exits.
      const [singlePrice, altDates] = await Promise.all([
        computePrice(input.service_slug, input.bedrooms, input.addon_slugs, {
          keeperCount: 1,
          wantsInsurance: input.wants_insurance,
        }),
        getAlternativeDates(input.zone_slug, input.booking_date, 14, 2),
      ]);
      throw new PartialAvailabilityError(
        {
          total_amount:      singlePrice.total_amount,
          commission_amount: singlePrice.commission_amount,
          commission_rate:   singlePrice.commission_rate,
        },
        altDates,
      );
    }
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
      keeper_count:         keeperCount,
      latitude:             input.latitude  ?? null,
      longitude:            input.longitude ?? null,
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
    keeper_count: keeperCount,
  });

  if (assignment.outcome === 'no_match') {
    console.warn(`[booking] ${booking.id}: no match in ${input.zone_slug} on ${input.booking_date}`);
    throw new NoAvailabilityError(input.zone_slug, input.booking_date);
  }

  console.log(`[booking] ${booking.id}: matched ${assignment.cleanerIds.length} keeper(s) — ${assignment.cleanerIds.join(', ')}`);

  // 7. Read the authoritative keeper list from booking_cleaners (role ASC = lead first)
  //    and fetch each keeper's public profile in a single IN query.
  const { data: bcRows, error: bcErr } = await supabase
    .from('booking_cleaners')
    .select('cleaner_id, role')
    .eq('booking_id', booking.id)
    .order('role', { ascending: true }); // 'lead' < 'second' alphabetically

  if (bcErr) throw bcErr;

  const assignedIds = (bcRows ?? []).map((r) => r.cleaner_id as string);
  if (assignedIds.length === 0) {
    throw new Error(`No keepers written to booking_cleaners for booking ${booking.id}.`);
  }

  const { data: cleanerRows, error: cleanerErr } = await supabase
    .from('cleaners')
    .select('id, first_name, last_name, photo_url, rating, total_jobs')
    .in('id', assignedIds);

  if (cleanerErr) throw cleanerErr;

  const cleanerMap = new Map(
    (cleanerRows ?? []).map((c) => [c.id as string, c]),
  );

  const cleaners: CleanerProfile[] = assignedIds.map((cid) => {
    const c = cleanerMap.get(cid);
    if (!c) throw new Error(`Failed to load profile for keeper ${cid}.`);
    return {
      id:         c.id as string,
      first_name: c.first_name as string,
      last_name:  c.last_name as string,
      photo_url:  (c.photo_url as string | null) ?? null,
      rating:     (c.rating as number | null) ?? null,
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

// ─── Public booking status (for customer status page) ─────────────────────────

export interface BookingStatusResult {
  id: string;
  status: string;
  keeper_count: number;
  transport_status: string;
  transport_fare: number | null;        // NGN
  transport_payment_ref: string | null; // PRQ_xxxxx — use to build pay link
  service_name: string | null;
  booking_date: string | null;
  address: string | null;
  first_name: string | null;
  total_amount: number | null;          // NGN, null if not yet confirmed
  cleaners: CleanerProfile[];           // populated once transport is cleared
}

/**
 * Returns the data needed by the customer booking-status page.
 * No auth needed — booking IDs are UUIDs (unguessable).
 * Returns null when the booking doesn't exist.
 *
 * Cleaners are only returned when transport_status is 'paid', 'waived', or
 * 'not_required' (i.e., dispatch is cleared). Before that, the customer knows
 * the keeper is assigned but full details wait until transport is settled.
 */
interface BkStatusRow {
  id: string;
  status: string;
  keeper_count: number | null;
  transport_status: string;
  transport_fare: number | string | null;
  transport_payment_ref: string | null;
  booking_date: string | null;
  address: string | null;
  total_amount_kobo: number | null;
  services: { name: string } | null;
  customers: { first_name: string } | null;
}

export async function getBookingStatus(bookingId: string): Promise<BookingStatusResult | null> {
  const { data: rawBooking, error } = await supabase
    .from('bookings')
    .select(
      'id, status, keeper_count, transport_status, transport_fare, transport_payment_ref, ' +
      'booking_date, address, total_amount_kobo, ' +
      'services(name), customers(first_name)',
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (error) throw error;
  if (!rawBooking) return null;

  const booking = rawBooking as unknown as BkStatusRow;

  const dispatchCleared = ['paid', 'waived', 'not_required'].includes(
    booking.transport_status,
  );

  let cleaners: CleanerProfile[] = [];

  if (dispatchCleared) {
    const { data: bcRows } = await supabase
      .from('booking_cleaners')
      .select('cleaner_id, role')
      .eq('booking_id', bookingId)
      .order('role', { ascending: true });

    const assignedIds = (bcRows ?? []).map((r) => r.cleaner_id as string);

    if (assignedIds.length > 0) {
      const { data: cleanerRows } = await supabase
        .from('cleaners')
        .select('id, first_name, last_name, photo_url, rating, total_jobs')
        .in('id', assignedIds);

      const cleanerMap = new Map((cleanerRows ?? []).map((c) => [c.id as string, c]));

      cleaners = assignedIds.map((cid) => {
        const c = cleanerMap.get(cid);
        return {
          id:         cid,
          first_name: (c?.first_name as string | undefined) ?? 'Keeper',
          last_name:  (c?.last_name  as string | undefined) ?? '',
          photo_url:  (c?.photo_url  as string | null | undefined) ?? null,
          rating:     (c?.rating     as number | null | undefined) ?? null,
          total_jobs: (c?.total_jobs as number | undefined) ?? 0,
        };
      });
    }
  }

  const svc = booking.services;
  const cust = booking.customers;
  const totalKobo = booking.total_amount_kobo;

  return {
    id:                    booking.id as string,
    status:                booking.status as string,
    keeper_count:          (booking.keeper_count as number | null) ?? 1,
    transport_status:      booking.transport_status as string,
    transport_fare:        booking.transport_fare != null ? Number(booking.transport_fare) : null,
    transport_payment_ref: (booking.transport_payment_ref as string | null) ?? null,
    service_name:          svc?.name ?? null,
    booking_date:          (booking.booking_date as string | null) ?? null,
    address:               (booking.address as string | null) ?? null,
    first_name:            cust?.first_name ?? null,
    total_amount:          totalKobo != null ? totalKobo / 100 : null,
    cleaners,
  };
}
