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
