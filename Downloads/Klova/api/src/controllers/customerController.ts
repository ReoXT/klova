import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';
import { normalizePhone } from '../lib/termiiClient';

/**
 * GET /customers/lookup?phone=08012345678
 *
 * Returns whether this phone number belongs to a returning customer and, if so,
 * a list of cleaners they've previously had confirmed or completed bookings with.
 * Used by the frontend to offer "request a previous keeper" to repeat customers.
 *
 * Only exposes public cleaner profile data — no customer PII is returned.
 */
export async function lookupCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = (req.query.phone as string | undefined)?.trim();
    if (!raw) {
      return res.json({ ok: true, data: { returning: false, cleaners: [] } });
    }

    let normalized: string;
    try {
      normalized = normalizePhone(raw);
    } catch {
      return res.json({ ok: true, data: { returning: false, cleaners: [] } });
    }

    // Look up customer by normalised phone
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', normalized)
      .maybeSingle();

    if (!customer) {
      return res.json({ ok: true, data: { returning: false, cleaners: [] } });
    }

    // Find distinct cleaners from their past confirmed/completed bookings,
    // most recent first, active and NIN-verified only.
    const { data: bookings } = await supabase
      .from('bookings')
      .select('cleaner_id, created_at')
      .eq('customer_id', customer.id)
      .in('status', ['confirmed', 'completed'])
      .not('cleaner_id', 'is', null)
      .order('created_at', { ascending: false });

    // Deduplicate cleaner IDs (keep first occurrence = most recent booking)
    const seenIds = new Set<string>();
    const cleanerIds: string[] = [];
    for (const b of bookings ?? []) {
      if (b.cleaner_id && !seenIds.has(b.cleaner_id)) {
        seenIds.add(b.cleaner_id);
        cleanerIds.push(b.cleaner_id);
        if (cleanerIds.length === 3) break;
      }
    }

    if (cleanerIds.length === 0) {
      return res.json({ ok: true, data: { returning: true, cleaners: [] } });
    }

    const { data: cleaners } = await supabase
      .from('cleaners')
      .select('id, first_name, last_name, photo_url, rating, total_jobs')
      .in('id', cleanerIds)
      .eq('status', 'active')
      .eq('nin_verified', true);

    // Re-sort to match the booking recency order we deduped above
    const cleanerMap = new Map((cleaners ?? []).map((c: { id: string }) => [c.id, c]));
    const ordered = cleanerIds.map((id) => cleanerMap.get(id)).filter(Boolean);

    return res.json({ ok: true, data: { returning: true, cleaners: ordered } });
  } catch (err) {
    next(err);
  }
}
