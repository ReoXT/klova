import { supabase } from '../lib/supabase';

/**
 * Returns the next available booking dates in a zone after a given date.
 * Used to offer alternatives when a requested date has no available cleaners.
 *
 * @param zoneSlug  - e.g. 'lekki-ajah'
 * @param requestedDate - YYYY-MM-DD; the date that had no availability
 * @param days      - how many days ahead to search (default 14)
 * @returns ordered, deduplicated list of YYYY-MM-DD strings with free slots
 */
export async function getAlternativeDates(
  zoneSlug: string,
  requestedDate: string,
  days = 14,
): Promise<string[]> {
  // 1. Resolve zone
  const { data: zone } = await supabase
    .from('zones')
    .select('id')
    .eq('slug', zoneSlug)
    .single();

  if (!zone) return [];

  // 2. Active cleaners in zone
  const { data: cleaners, error: cleanersErr } = await supabase
    .from('cleaners')
    .select('id')
    .eq('zone_id', zone.id)
    .eq('status', 'active');

  if (cleanersErr) throw cleanersErr;

  const cleanerIds = (cleaners ?? []).map((c: { id: string }) => c.id);
  if (cleanerIds.length === 0) return [];

  // 3. Free slots in (requestedDate, requestedDate + days] — strictly after the failed date
  const end = new Date(requestedDate);
  end.setUTCDate(end.getUTCDate() + days);
  const endDate = end.toISOString().slice(0, 10);

  const { data: slots, error: slotsErr } = await supabase
    .from('cleaner_availability')
    .select('available_date')
    .in('cleaner_id', cleanerIds)
    .eq('is_booked', false)
    .gt('available_date', requestedDate)
    .lte('available_date', endDate)
    .order('available_date');

  if (slotsErr) throw slotsErr;

  // Deduplicate — multiple cleaners may be free on the same day
  const seen = new Set<string>();
  return (slots ?? [])
    .map((s: { available_date: string }) => s.available_date)
    .filter((d: string) => (seen.has(d) ? false : (seen.add(d), true)));
}
