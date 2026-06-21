import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from '../lib/supabase';
import { getAlternativeDates } from '../services/availabilityService';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function chain(result: { data: unknown; error: unknown }) {
  const b: any = {};
  b.then = (resolve: (v: any) => any, reject?: (v: any) => any) =>
    Promise.resolve(result).then(resolve, reject);
  b.catch = (reject: (v: any) => any) => Promise.resolve(result).catch(reject);
  for (const m of ['select', 'eq', 'in', 'gt', 'lte', 'gte', 'order', 'not']) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  b.single = vi.fn().mockResolvedValue(result);
  return b;
}

const mockFrom = () => vi.mocked(supabase.from);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ZONE_SLUG = 'lekki-ajah';
const ZONE_ID = 'zone-uuid-lekki';
const REQUESTED_DATE = '2026-07-01';

function mockThreeCalls(
  zoneData: { id: string } | null,
  cleanerRows: { id: string }[],
  slotRows: { available_date: string }[],
) {
  mockFrom()
    .mockReturnValueOnce(chain({ data: zoneData, error: null }) as any)
    .mockReturnValueOnce(chain({ data: cleanerRows, error: null }) as any)
    .mockReturnValueOnce(chain({ data: slotRows, error: null }) as any);
}

// ─── Core scenario (from requirements) ───────────────────────────────────────

describe('getAlternativeDates — core requirement', () => {
  it('returns a date 2 days later when requested date has no availability', async () => {
    mockThreeCalls(
      { id: ZONE_ID },
      [{ id: 'c1' }],
      [{ available_date: '2026-07-03' }], // 2 days after 2026-07-01
    );

    const dates = await getAlternativeDates(ZONE_SLUG, REQUESTED_DATE);

    expect(dates).toEqual(['2026-07-03']);
  });
});

// ─── No-alternatives paths ────────────────────────────────────────────────────

describe('getAlternativeDates — no alternatives', () => {
  it('returns [] when the zone slug does not exist', async () => {
    mockFrom().mockReturnValueOnce(chain({ data: null, error: null }) as any);

    const dates = await getAlternativeDates('unknown-zone', REQUESTED_DATE);

    expect(dates).toEqual([]);
    expect(mockFrom()).toHaveBeenCalledTimes(1); // stops after zone lookup
  });

  it('returns [] when the zone has no active cleaners', async () => {
    mockFrom()
      .mockReturnValueOnce(chain({ data: { id: ZONE_ID }, error: null }) as any)
      .mockReturnValueOnce(chain({ data: [], error: null }) as any); // no cleaners

    const dates = await getAlternativeDates(ZONE_SLUG, REQUESTED_DATE);

    expect(dates).toEqual([]);
    expect(mockFrom()).toHaveBeenCalledTimes(2); // stops after cleaner lookup
  });

  it('returns [] when cleaners exist but all slots in the window are booked', async () => {
    mockThreeCalls({ id: ZONE_ID }, [{ id: 'c1' }], []); // no free slots

    const dates = await getAlternativeDates(ZONE_SLUG, REQUESTED_DATE);

    expect(dates).toEqual([]);
  });
});

// ─── Multiple alternatives ────────────────────────────────────────────────────

describe('getAlternativeDates — multiple results', () => {
  it('returns all available dates sorted ascending', async () => {
    mockThreeCalls(
      { id: ZONE_ID },
      [{ id: 'c1' }],
      [
        { available_date: '2026-07-03' },
        { available_date: '2026-07-05' },
        { available_date: '2026-07-10' },
      ],
    );

    const dates = await getAlternativeDates(ZONE_SLUG, REQUESTED_DATE);

    expect(dates).toEqual(['2026-07-03', '2026-07-05', '2026-07-10']);
  });

  it('deduplicates dates when multiple cleaners are free on the same day', async () => {
    mockThreeCalls(
      { id: ZONE_ID },
      [{ id: 'c1' }, { id: 'c2' }],
      [
        { available_date: '2026-07-03' }, // c1
        { available_date: '2026-07-03' }, // c2 — same date, should appear once
        { available_date: '2026-07-05' },
      ],
    );

    const dates = await getAlternativeDates(ZONE_SLUG, REQUESTED_DATE);

    expect(dates).toEqual(['2026-07-03', '2026-07-05']);
  });
});

// ─── minCleaners=2 (two-keeper alternative dates) ────────────────────────────
//
// When a 2-keeper booking fails partial-availability detection, the frontend
// needs alternative dates where AT LEAST 2 distinct cleaners are free.
// Dates with only 1 free cleaner must be excluded.

describe('getAlternativeDates — minCleaners=2', () => {
  it('excludes dates where only 1 cleaner is free', async () => {
    // 07-03: only c1 free (1 slot) → excluded
    // 07-05: c1 + c2 free (2 slots) → included
    mockThreeCalls(
      { id: ZONE_ID },
      [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
      [
        { available_date: '2026-07-03' }, // c1 only
        { available_date: '2026-07-05' }, // c1
        { available_date: '2026-07-05' }, // c2
      ],
    );

    const dates = await getAlternativeDates(ZONE_SLUG, REQUESTED_DATE, 14, 2);

    expect(dates).toEqual(['2026-07-05']);
  });

  it('returns [] when no date in the window has 2+ cleaners free', async () => {
    // c1 free 07-03, c2 free 07-05 — never two on the same day
    mockThreeCalls(
      { id: ZONE_ID },
      [{ id: 'c1' }, { id: 'c2' }],
      [
        { available_date: '2026-07-03' },
        { available_date: '2026-07-05' },
      ],
    );

    const dates = await getAlternativeDates(ZONE_SLUG, REQUESTED_DATE, 14, 2);

    expect(dates).toEqual([]);
  });

  it('returns a date where 3 cleaners are all free', async () => {
    mockThreeCalls(
      { id: ZONE_ID },
      [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
      [
        { available_date: '2026-07-08' }, // c1
        { available_date: '2026-07-08' }, // c2
        { available_date: '2026-07-08' }, // c3 — 3 cleaners on one day, still qualifies
      ],
    );

    const dates = await getAlternativeDates(ZONE_SLUG, REQUESTED_DATE, 14, 2);

    expect(dates).toEqual(['2026-07-08']);
  });
});
