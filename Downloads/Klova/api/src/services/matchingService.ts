import { supabase } from '../lib/supabase';

export const NO_MATCH = 'NO_MATCH' as const;
export type MatchResult = string | typeof NO_MATCH;

export interface BookingForMatch {
  zone_id: string;
  customer_id: string;
  booking_date: string; // YYYY-MM-DD
  requested_cleaner_id: string | null;
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
  const { data: cleaners, error: cleanersErr } = await supabase
    .from('cleaners')
    .select('id, rating')
    .eq('zone_id', booking.zone_id)
    .eq('status', 'active')
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

  // ── Priority 1: Customer's explicitly requested cleaner ──────────────────────
  // Only honoured if they're available, active, and in the right zone.
  if (booking.requested_cleaner_id && candidateSet.has(booking.requested_cleaner_id)) {
    return booking.requested_cleaner_id;
  }

  // ── Priority 2: Cleaners this customer has previously rated 5 stars ───────────
  // Among those, pick the best-rated then least-loaded.
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

  const preferred = enriched.filter((c) => fiveStarIds.has(c.id));
  if (preferred.length > 0) {
    return ranked(preferred)[0].id;
  }

  // ── Priority 3: General pool — best rated, then fewest recent jobs ─────────────
  return ranked(enriched)[0].id;
}

function ranked(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort((a, b) => b.rating - a.rating || a.recent_jobs - b.recent_jobs);
}
