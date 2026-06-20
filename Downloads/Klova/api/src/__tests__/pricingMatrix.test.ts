import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../config', () => ({
  config: { commissionRate: 0.22 },
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from '../lib/supabase';
import { computePrice } from '../services/pricingService';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

// Thenable chain — every builder method returns self; terminal awaits resolve via .then.
function chain(result: { data: unknown; error: unknown }) {
  const b: any = {};
  b.then = (resolve: (v: any) => any, reject?: (v: any) => any) =>
    Promise.resolve(result).then(resolve, reject);
  b.catch = (fn: (v: any) => any) => Promise.resolve(result).catch(fn);
  b.single = vi.fn().mockResolvedValue(result);
  b.maybeSingle = vi.fn().mockResolvedValue(result);
  for (const m of ['select', 'eq', 'in', 'order']) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  return b;
}

const mockFrom = () => vi.mocked(supabase.from);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Full service × bedroom price matrix ──────────────────────────────────────
//
// Source of truth: CLAUDE.md pricing table.
// Formula: commission = Math.round(baseKobo × 0.22) / 100  (NGN)
//
// Columns: service slug | bedrooms | base price (kobo) | expected commission (NGN)

type MatrixRow = [string, string, number, number];

const MATRIX: MatrixRow[] = [
  // Standard Clean
  ['standard',          '1',   500_000, 1_100],
  ['standard',          '2',   950_000, 2_090],
  ['standard',          '3', 1_400_000, 3_080],
  ['standard',          '4+', 1_800_000, 3_960],
  // Deep Clean
  ['deep',              '1', 1_850_000, 4_070],
  ['deep',              '2', 3_000_000, 6_600],
  ['deep',              '3', 4_400_000, 9_680],
  ['deep',              '4+', 6_500_000, 14_300],
  // Move-in / Move-out
  ['move-in-move-out',  '1', 4_000_000, 8_800],
  ['move-in-move-out',  '2', 5_600_000, 12_320],
  ['move-in-move-out',  '3', 7_400_000, 16_280],
  ['move-in-move-out',  '4+', 9_000_000, 19_800],
  // Post-construction
  ['post-construction', '1', 4_500_000, 9_900],
  ['post-construction', '2', 6_600_000, 14_520],
  ['post-construction', '3', 8_800_000, 19_360],
  ['post-construction', '4+', 11_000_000, 24_200],
];

describe('computePrice — full 4×4 service × bedroom matrix (no add-ons, no insurance)', () => {
  it.each(MATRIX)(
    '%s %s-bed',
    async (service, bedrooms, baseKobo, expectedCommission) => {
      mockFrom()
        .mockReturnValueOnce(chain({ data: { id: 'svc-id', name: service }, error: null }) as any)
        .mockReturnValueOnce(chain({ data: { amount_kobo: baseKobo }, error: null }) as any);

      const result = await computePrice(service, bedrooms, []);

      expect(result.base_amount).toBe(baseKobo / 100);
      expect(result.addons_amount).toBe(0);
      expect(result.insurance_amount).toBe(0);
      expect(result.total_amount).toBe(baseKobo / 100);
      expect(result.commission_amount).toBe(expectedCommission);
      expect(result.commission_rate).toBe(0.22);
    },
  );
});

// ─── Add-on combinations ──────────────────────────────────────────────────────

describe('computePrice — add-on combinations', () => {
  it('laundry (₦3,500) + ironing (₦4,600) on Standard 2-bed → correct total and commission', async () => {
    // base ₦9,500 + laundry ₦3,500 + ironing ₦4,600 = ₦17,600
    // commission = round(1_760_000 kobo × 0.22) / 100 = ₦3,872
    mockFrom()
      .mockReturnValueOnce(chain({ data: { id: 'svc' }, error: null }) as any)
      .mockReturnValueOnce(chain({ data: { amount_kobo: 950_000 }, error: null }) as any)
      .mockReturnValueOnce(
        chain({
          data: [
            { id: 'a1', slug: 'laundry',  amount_kobo: 350_000 },
            { id: 'a2', slug: 'ironing',  amount_kobo: 460_000 },
          ],
          error: null,
        }) as any,
      );

    const result = await computePrice('standard', '2', ['laundry', 'ironing']);

    expect(result.base_amount).toBe(9_500);
    expect(result.addons_amount).toBe(8_100);    // 3500 + 4600
    expect(result.total_amount).toBe(17_600);    // 9500 + 8100
    expect(result.commission_amount).toBe(3_872); // round(1_760_000 × 0.22) / 100
  });

  it('all three add-ons (laundry + ironing + wardrobe) → correct combined total and commission', async () => {
    // base ₦9,500 + laundry ₦3,500 + ironing ₦4,600 + wardrobe ₦4,000 = ₦21,600
    // commission = round(2_160_000 × 0.22) / 100 = ₦4,752
    mockFrom()
      .mockReturnValueOnce(chain({ data: { id: 'svc' }, error: null }) as any)
      .mockReturnValueOnce(chain({ data: { amount_kobo: 950_000 }, error: null }) as any)
      .mockReturnValueOnce(
        chain({
          data: [
            { id: 'a1', slug: 'laundry',            amount_kobo: 350_000 },
            { id: 'a2', slug: 'ironing',            amount_kobo: 460_000 },
            { id: 'a3', slug: 'wardrobe-organising', amount_kobo: 400_000 },
          ],
          error: null,
        }) as any,
      );

    const result = await computePrice('standard', '2', [
      'laundry', 'ironing', 'wardrobe-organising',
    ]);

    expect(result.base_amount).toBe(9_500);
    expect(result.addons_amount).toBe(12_100);   // 3500 + 4600 + 4000
    expect(result.total_amount).toBe(21_600);
    expect(result.commission_amount).toBe(4_752); // round(2_160_000 × 0.22) / 100
  });

  it('single add-on on the most expensive service — Post-construction 4-bed+ + wardrobe', async () => {
    // base ₦110,000 + wardrobe ₦4,000 = ₦114,000
    // commission = round(11_400_000 × 0.22) / 100 = ₦25,080
    mockFrom()
      .mockReturnValueOnce(chain({ data: { id: 'svc' }, error: null }) as any)
      .mockReturnValueOnce(chain({ data: { amount_kobo: 11_000_000 }, error: null }) as any)
      .mockReturnValueOnce(
        chain({
          data: [{ id: 'a1', slug: 'wardrobe-organising', amount_kobo: 400_000 }],
          error: null,
        }) as any,
      );

    const result = await computePrice('post-construction', '4+', ['wardrobe-organising']);

    expect(result.base_amount).toBe(110_000);
    expect(result.addons_amount).toBe(4_000);
    expect(result.total_amount).toBe(114_000);
    expect(result.commission_amount).toBe(25_080);
  });
});

// ─── Insurance commission attribution ─────────────────────────────────────────
//
// Insurance (₦1,300) goes 100% to Klova, not the 22% split.
// commission = Math.round(cleaningFee × 0.22) + insuranceFee

describe('computePrice — insurance commission attribution', () => {
  it('insurance: 100% of ₦1,300 added to commission, not 22%', async () => {
    // Standard 1-bed ₦5,000 + insurance ₦1,300 = ₦6,300
    // commission = round(500_000 × 0.22) + 130_000 = 110_000 + 130_000 = 240_000 kobo = ₦2,400
    mockFrom()
      .mockReturnValueOnce(chain({ data: { id: 'svc' }, error: null }) as any)
      .mockReturnValueOnce(chain({ data: { amount_kobo: 500_000 }, error: null }) as any);

    const result = await computePrice('standard', '1', [], { wantsInsurance: true });

    expect(result.base_amount).toBe(5_000);
    expect(result.insurance_amount).toBe(1_300);
    expect(result.total_amount).toBe(6_300);
    expect(result.commission_amount).toBe(2_400); // not 1_386 (which would be 22% of full total)
  });

  it('insurance + add-ons: commission = 22% of (base+addons) + 100% of insurance', async () => {
    // Standard 2-bed ₦9,500 + laundry ₦3,500 + insurance ₦1,300 = ₦14,300
    // cleaning fee = 9500 + 3500 = ₦13,000
    // commission = round(1_300_000 × 0.22) + 130_000 = 286_000 + 130_000 = 416_000 kobo = ₦4,160
    mockFrom()
      .mockReturnValueOnce(chain({ data: { id: 'svc' }, error: null }) as any)
      .mockReturnValueOnce(chain({ data: { amount_kobo: 950_000 }, error: null }) as any)
      .mockReturnValueOnce(
        chain({
          data: [{ id: 'a1', slug: 'laundry', amount_kobo: 350_000 }],
          error: null,
        }) as any,
      );

    const result = await computePrice('standard', '2', ['laundry'], { wantsInsurance: true });

    expect(result.base_amount).toBe(9_500);
    expect(result.addons_amount).toBe(3_500);
    expect(result.insurance_amount).toBe(1_300);
    expect(result.total_amount).toBe(14_300);
    expect(result.commission_amount).toBe(4_160);
  });
});
