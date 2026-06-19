import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock config before any imports that read it
vi.mock('../config', () => ({
  config: { commissionRate: 0.22 },
}));

// Mock the Supabase client — only `from` is used by the pricing service
vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from '../lib/supabase';
import { computePrice, ValidationError } from '../services/pricingService';

// Builds a fluent Supabase query chain where terminal calls resolve with `result`.
function chain(result: { data: unknown; error: null | { code: string; message?: string } }) {
  const b: Record<string, unknown> = {
    single: vi.fn().mockResolvedValue(result),
    in: vi.fn().mockResolvedValue(result),
  };
  ['select', 'eq', 'order'].forEach((m) => {
    b[m] = vi.fn().mockReturnValue(b);
  });
  return b;
}

const mockFrom = () => vi.mocked(supabase.from);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Standard 2-bed + Laundry ────────────────────────────────────────────────
describe('computePrice — 2-bed Standard Clean + Laundry add-on', () => {
  it('returns the correct total and commission', async () => {
    // supabase.from() is called three times in sequence:
    // 1. services  2. pricing  3. addons
    mockFrom()
      .mockReturnValueOnce(chain({ data: { id: 'svc-uuid', name: 'Standard Clean' }, error: null }) as any)
      .mockReturnValueOnce(chain({ data: { amount_kobo: 950_000 }, error: null }) as any)
      .mockReturnValueOnce(
        chain({ data: [{ slug: 'laundry', amount_kobo: 350_000 }], error: null }) as any,
      );

    const result = await computePrice('standard', '2', ['laundry']);

    // base ₦9,500 + laundry ₦3,500 = ₦13,000
    expect(result.base_amount).toBe(9_500);
    expect(result.addons_amount).toBe(3_500);
    expect(result.total_amount).toBe(13_000);

    // commission = Math.round(1_300_000 kobo × 0.22) / 100 = ₦2,860
    expect(result.commission_amount).toBe(2_860);
    expect(result.commission_rate).toBe(0.22);
  });
});

// ─── No add-ons ──────────────────────────────────────────────────────────────
describe('computePrice — no add-ons', () => {
  it('returns zero addons_amount and correct commission', async () => {
    mockFrom()
      .mockReturnValueOnce(chain({ data: { id: 'svc-uuid', name: 'Deep Clean' }, error: null }) as any)
      .mockReturnValueOnce(chain({ data: { amount_kobo: 3_000_000 }, error: null }) as any);

    const result = await computePrice('deep', '2', []);

    expect(result.base_amount).toBe(30_000);
    expect(result.addons_amount).toBe(0);
    expect(result.total_amount).toBe(30_000);
    // Math.round(3_000_000 × 0.22) = 660_000 kobo = ₦6,600
    expect(result.commission_amount).toBe(6_600);
  });
});

// ─── Insurance ───────────────────────────────────────────────────────────────
describe('computePrice — with insurance', () => {
  it('attributes 100% of insurance to commission, not 22%', async () => {
    // 1-bed Standard Clean ₦5,000 + insurance ₦1,300
    mockFrom()
      .mockReturnValueOnce(chain({ data: { id: 'svc-uuid', name: 'Standard Clean' }, error: null }) as any)
      .mockReturnValueOnce(chain({ data: { amount_kobo: 500_000 }, error: null }) as any);

    const result = await computePrice('standard', '1', [], { wantsInsurance: true });

    expect(result.base_amount).toBe(5_000);
    expect(result.addons_amount).toBe(0);
    expect(result.insurance_amount).toBe(1_300);
    expect(result.total_amount).toBe(6_300);

    // 22% of ₦5,000 cleaning fee = ₦1,100  +  100% of ₦1,300 insurance = ₦1,300
    // Total commission = ₦2,400 (NOT ₦1,386 which would be wrong 22% of full total)
    expect(result.commission_amount).toBe(2_400);
    expect(result.commission_rate).toBe(0.22);
  });

  it('insurance with add-ons: commission is 22% of (base+addons) + 100% of insurance', async () => {
    // 2-bed Standard ₦9,500 + Laundry ₦3,500 + insurance ₦1,300
    mockFrom()
      .mockReturnValueOnce(chain({ data: { id: 'svc-uuid', name: 'Standard Clean' }, error: null }) as any)
      .mockReturnValueOnce(chain({ data: { amount_kobo: 950_000 }, error: null }) as any)
      .mockReturnValueOnce(
        chain({ data: [{ id: 'addon-uuid', slug: 'laundry', amount_kobo: 350_000 }], error: null }) as any,
      );

    const result = await computePrice('standard', '2', ['laundry'], { wantsInsurance: true });

    expect(result.base_amount).toBe(9_500);
    expect(result.addons_amount).toBe(3_500);
    expect(result.insurance_amount).toBe(1_300);
    expect(result.total_amount).toBe(14_300);

    // 22% of ₦13,000 cleaning fee = ₦2,860  +  100% of ₦1,300 insurance = ₦1,300
    // Total commission = ₦4,160
    expect(result.commission_amount).toBe(4_160);
  });
});

// ─── Validation errors ───────────────────────────────────────────────────────
describe('computePrice — validation errors', () => {
  it('rejects an invalid bedroom size immediately', async () => {
    const result = computePrice('standard', '5', []);
    await expect(result).rejects.toBeInstanceOf(ValidationError);
    await expect(result).rejects.toThrow('Invalid apartment size');
    // Supabase should never be called for an invalid bedroom value
    expect(mockFrom()).not.toHaveBeenCalled();
  });

  it('rejects an unknown service slug', async () => {
    mockFrom().mockReturnValueOnce(
      chain({ data: null, error: { code: 'PGRST116' } }) as any,
    );
    const result = computePrice('luxury-wash', '2', []);
    await expect(result).rejects.toBeInstanceOf(ValidationError);
    await expect(result).rejects.toThrow('Unknown service');
  });

  it('rejects an unknown add-on slug', async () => {
    mockFrom()
      .mockReturnValueOnce(chain({ data: { id: 'svc-uuid' }, error: null }) as any)
      .mockReturnValueOnce(chain({ data: { amount_kobo: 950_000 }, error: null }) as any)
      // Supabase .in() only returns the slugs it knows about — 'deep-scrub' not found
      .mockReturnValueOnce(chain({ data: [], error: null }) as any);

    const result = computePrice('standard', '2', ['deep-scrub']);
    await expect(result).rejects.toBeInstanceOf(ValidationError);
    await expect(result).rejects.toThrow('Unknown add-on');
  });
});
