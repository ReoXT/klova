import { supabase } from '../lib/supabase';

export const NO_MATCH = 'NO_MATCH' as const;

/** Ordered candidate list (best first) or NO_MATCH if the zone has no one available. */
export type MatchResult = string[] | typeof NO_MATCH;

export interface BookingForMatch {
  zone_id: string;
  customer_id: string;
  booking_date: string; // YYYY-MM-DD
  requested_cleaner_id: string | null;
  keeper_count?: number;
  latitude?: number | null;
  longitude?: number | null;
}

interface Candidate {
  id: string;
  rating: number;
  recent_jobs: number;
}

/**
 * Selects the best available cleaner for a booking.
 *
 * Priority order:
 *   1. Customer's explicitly requested cleaner (if available)
 *   2. Cleaners the customer has previously rated 5 stars (best rated, least loaded)
 *   3. General pool (rating DESC, recent_jobs ASC)
 *
 * Returns NO_MATCH if no active, available candidates exist in the zone.
 * Does NOT assign the cleaner — that write (with row locking) is handled by the caller.
 */
/**
 * Returns an ordered list of candidate cleaner IDs for a booking, or NO_MATCH.
 * The list encodes priority: [P1 requested?, ...P2 preferred, ...P3 rest].
 * The caller passes this list to assignCleaner(), which tries them in order
 * with SELECT FOR UPDATE locking — the first one still available wins.
 */
export async function matchCleaner(booking: BookingForMatch): Promise<MatchResult> {
  // ── Step 1: Collect cleaner IDs with an unbooked slot on the requested date ──
  const { data: availability, error: availErr } = await supabase
    .from('cleaner_availability')
    .select('cleaner_id')
    .eq('available_date', booking.booking_date)
    .eq('is_booked', false);

  if (availErr) throw availErr;

  const availableIds = (availability ?? []).map((a: { cleaner_id: string }) => a.cleaner_id);
  if (availableIds.length === 0) return NO_MATCH;

  // ── Step 2: Intersect with active cleaners in the booking's zone ─────────────
  // Cleaners without coordinates are excluded — location is required for
  // transport estimate calculation. They remain excluded until an admin or
  // the keeper sets valid lat/lng via the location picker.
  const { data: cleaners, error: cleanersErr } = await supabase
    .from('cleaners')
    .select('id, rating')
    .eq('zone_id', booking.zone_id)
    .eq('status', 'active')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .in('id', availableIds);

  if (cleanersErr) throw cleanersErr;

  const candidates = cleaners ?? [];
  if (candidates.length === 0) return NO_MATCH;

  const candidateIds = candidates.map((c: { id: string }) => c.id);

  // ── Step 3: Compute recent_jobs per candidate (last 7 days, not a stored column) ──
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  const cutoff = sevenDaysAgo.toISOString().slice(0, 10);

  const { data: recentBookings, error: recentErr } = await supabase
    .from('bookings')
    .select('cleaner_id')
    .in('cleaner_id', candidateIds)
    .gte('booking_date', cutoff);

  if (recentErr) throw recentErr;

  const recentJobsMap: Record<string, number> = Object.fromEntries(
    candidateIds.map((id: string) => [id, 0]),
  );
  for (const b of recentBookings ?? []) {
    if (b.cleaner_id) recentJobsMap[b.cleaner_id]++;
  }

  const enriched: Candidate[] = candidates.map((c: { id: string; rating: number }) => ({
    id: c.id,
    rating: c.rating,
    recent_jobs: recentJobsMap[c.id] ?? 0,
  }));

  const candidateSet = new Set(candidateIds);

  // Always fetch 5-star ratings regardless of whether P1 fires — we need the
  // full ordered list so the Postgres assignment function has fallbacks.
  const { data: fiveStarRatings, error: ratingsErr } = await supabase
    .from('ratings')
    .select('cleaner_id')
    .eq('customer_id', booking.customer_id)
    .eq('score', 5)
    .in('cleaner_id', candidateIds);

  if (ratingsErr) throw ratingsErr;

  const fiveStarIds = new Set(
    (fiveStarRatings ?? []).map((r: { cleaner_id: string }) => r.cleaner_id),
  );

  const ordered: string[] = [];
  const added = new Set<string>();

  // ── Priority 1: Customer's explicitly requested cleaner ──────────────────────
  if (booking.requested_cleaner_id && candidateSet.has(booking.requested_cleaner_id)) {
    ordered.push(booking.requested_cleaner_id);
    added.add(booking.requested_cleaner_id);
  }

  // ── Priority 2: Cleaners this customer has previously rated 5 stars ───────────
  for (const c of ranked(enriched.filter((c) => fiveStarIds.has(c.id) && !added.has(c.id)))) {
    ordered.push(c.id);
    added.add(c.id);
  }

  // ── Priority 3: General pool — best rated, then fewest recent jobs ─────────────
  for (const c of ranked(enriched.filter((c) => !added.has(c.id)))) {
    ordered.push(c.id);
  }

  return ordered;
}

function ranked(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort((a, b) => b.rating - a.rating || a.recent_jobs - b.recent_jobs);
}
