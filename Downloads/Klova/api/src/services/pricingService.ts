import { supabase } from '../lib/supabase';
import { config } from '../config';

export class ValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const VALID_BEDROOMS = ['1', '2', '3', '4+'] as const;
type Bedrooms = (typeof VALID_BEDROOMS)[number];

export interface PriceBreakdown {
  base_amount: number;       // NGN
  addons_amount: number;     // NGN
  total_amount: number;      // NGN
  commission_amount: number; // NGN
  commission_rate: number;
}

export interface PricingGrid {
  services: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    prices: Record<string, number>; // bedrooms key -> NGN
  }>;
  addons: Array<{
    id: string;
    name: string;
    slug: string;
    amount: number; // NGN
  }>;
}

/**
 * Server-side source of truth for booking cost.
 * Never trust amounts sent from the browser — always call this before charging.
 */
export async function computePrice(
  serviceSlug: string,
  bedrooms: string,
  addonSlugs: string[],
): Promise<PriceBreakdown> {
  if (!VALID_BEDROOMS.includes(bedrooms as Bedrooms)) {
    throw new ValidationError(
      `Invalid apartment size "${bedrooms}". Valid values: ${VALID_BEDROOMS.join(', ')}.`,
    );
  }

  // Validate service and get its id
  const { data: service, error: svcErr } = await supabase
    .from('services')
    .select('id, name')
    .eq('slug', serviceSlug)
    .single();

  if (svcErr || !service) {
    throw new ValidationError(`Unknown service "${serviceSlug}".`);
  }

  // Fetch base price for this service + bedroom count
  const { data: pricing, error: priceErr } = await supabase
    .from('pricing')
    .select('amount_kobo')
    .eq('service_id', service.id)
    .eq('bedrooms', bedrooms)
    .single();

  if (priceErr || !pricing) {
    throw new ValidationError(
      `No price configured for service "${serviceSlug}" / ${bedrooms} bedroom(s).`,
    );
  }

  const baseKobo: number = pricing.amount_kobo;

  // Fetch and validate add-ons
  let addonsKobo = 0;
  if (addonSlugs.length > 0) {
    const { data: addons, error: addonsErr } = await supabase
      .from('addons')
      .select('slug, amount_kobo')
      .in('slug', addonSlugs);

    if (addonsErr) throw addonsErr;

    const found = new Set((addons ?? []).map((a: { slug: string }) => a.slug));
    const unknown = addonSlugs.filter((s) => !found.has(s));
    if (unknown.length > 0) {
      throw new ValidationError(`Unknown add-on(s): ${unknown.join(', ')}.`);
    }

    addonsKobo = (addons ?? []).reduce(
      (sum: number, a: { amount_kobo: number }) => sum + a.amount_kobo,
      0,
    );
  }

  const totalKobo = baseKobo + addonsKobo;
  const commissionKobo = Math.round(totalKobo * config.commissionRate);

  return {
    base_amount: baseKobo / 100,
    addons_amount: addonsKobo / 100,
    total_amount: totalKobo / 100,
    commission_amount: commissionKobo / 100,
    commission_rate: config.commissionRate,
  };
}

/**
 * Returns the full pricing grid and add-on list for the frontend calculator.
 */
export async function getPricingGrid(): Promise<PricingGrid> {
  const [servicesResult, addonsResult] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, slug, description, pricing(bedrooms, amount_kobo)')
      .order('name'),
    supabase
      .from('addons')
      .select('id, name, slug, amount_kobo')
      .order('name'),
  ]);

  if (servicesResult.error) throw servicesResult.error;
  if (addonsResult.error) throw addonsResult.error;

  return {
    services: (servicesResult.data ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      description: s.description,
      prices: Object.fromEntries(
        (s.pricing ?? []).map((p: { bedrooms: string; amount_kobo: number }) => [
          p.bedrooms,
          p.amount_kobo / 100,
        ]),
      ),
    })),
    addons: (addonsResult.data ?? []).map((a: any) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      amount: a.amount_kobo / 100,
    })),
  };
}
