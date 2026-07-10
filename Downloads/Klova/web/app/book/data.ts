import type { ServiceSlug, BedroomCount, BookingData, PriceBreakdown, LivePricingData } from "./types";

export const SERVICES = [
  {
    slug: "standard" as ServiceSlug,
    name: "Standard Clean",
    description: "Regular upkeep: vacuuming, mopping, surface wipes, bathrooms and kitchen cleaned.",
    pricing: { "1": 5000, "2": 9500, "3": 14000, "4+": 18000 } as Record<BedroomCount, number>,
  },
  {
    slug: "deep" as ServiceSlug,
    name: "Deep Clean",
    description: "Thorough scrub of every surface, grout, fixtures and hard-to-reach corners.",
    pricing: { "1": 18500, "2": 30000, "3": 44000, "4+": 65000 } as Record<BedroomCount, number>,
  },
  {
    slug: "move-in-out" as ServiceSlug,
    name: "Move-in / Move-out",
    description: "End-to-end clean for empty apartments, inside appliances and all cupboards.",
    pricing: { "1": 40000, "2": 56000, "3": 74000, "4+": 90000 } as Record<BedroomCount, number>,
  },
  {
    slug: "post-construction" as ServiceSlug,
    name: "Post-construction",
    description: "Removes dust, paint spots, cement residue and construction debris throughout.",
    pricing: { "1": 45000, "2": 66000, "3": 88000, "4+": 110000 } as Record<BedroomCount, number>,
  },
];

export const EXTRAS = [
  { slug: "ironing",   name: "Ironing",                price: 4600, description: "Clothes ironed and neatly hung" },
  { slug: "laundry",  name: "Laundry",                price: 3500, description: "Wash and dry your laundry" },
  { slug: "wardrobe", name: "Wardrobe Organising",    price: 4000, description: "Sort and arrange wardrobe contents" },
  { slug: "appliances",name:"Appliance Interiors",    price: 1500, description: "₦1,500 per appliance, customise on the next page", perUnit: true },
  { slug: "cabinets", name: "Cabinet & Drawer Detailing", price: 1500, description: "Deep-clean inside all cabinets and drawers" },
  { slug: "windows",  name: "Window Cleaning",        price: 2000, description: "Interior glass and frames for all windows" },
  { slug: "fans",     name: "Fan Cleaning",           price: 1600, description: "Dismantle, clean blades and reassemble all fans" },
  { slug: "walls",    name: "Wall Washing",           price: 2300, description: "Wipe down all walls from top to bottom" },
  { slug: "compound", name: "Compound Cleaning",      price: 3000, description: "Sweep and tidy the compound and outdoor areas" },
];

export const APPLIANCES = [
  { slug: "oven",           name: "Oven" },
  { slug: "fridge",         name: "Fridge" },
  { slug: "freezer",        name: "Freezer" },
  { slug: "microwave",      name: "Microwave" },
  { slug: "coffee_machine", name: "Coffee Machine" },
  { slug: "toaster",        name: "Toaster" },
];

export const TIME_SLOTS = [
  "7am–9am",
  "9am–12pm",
  "12pm–2pm",
  "2pm–4pm",
] as const;

export const ZONES = [
  { slug: "lekki-ajah", name: "Lekki / Ajah", active: true },
  { slug: "victoria-island", name: "Victoria Island", active: false },
  { slug: "ikeja", name: "Ikeja", active: false },
  { slug: "surulere", name: "Surulere", active: false },
];

const LEKKI_KEYWORDS = [
  "lekki", "ajah", "chevron", "vgc", "victoria garden city",
  "jakande", "sangotedo", "orchid", "megamound", "agungi",
  "osapa", "ikota", "ologolo", "oniru", "abraham adesanya",
  "lekki phase", "lekki gardens",
];

const COMING_SOON: { keywords: string[]; zone: string }[] = [
  { keywords: ["victoria island", "ikoyi", "oniru estate"], zone: "Victoria Island" },
  { keywords: ["ikeja", "maryland", "ojodu", "berger", "magodo", "ketu"], zone: "Ikeja" },
  { keywords: ["surulere", "yaba", "ojuelegba", "eric moore"], zone: "Surulere" },
  { keywords: ["apapa", "festac", "amuwo", "satellite town"], zone: "Apapa / Festac" },
  { keywords: ["lagos island", "tinubu", "idumota", "balogun"], zone: "Lagos Island" },
];

export type AddressResult =
  | { ok: true; zone: "lekki-ajah" }
  | { ok: false; comingSoon: true; zoneName: string }
  | { ok: false; comingSoon: false };

export function validateAddress(raw: string): AddressResult {
  const lower = raw.toLowerCase();
  if (LEKKI_KEYWORDS.some((k) => lower.includes(k))) {
    return { ok: true, zone: "lekki-ajah" };
  }
  for (const { keywords, zone } of COMING_SOON) {
    if (keywords.some((k) => lower.includes(k))) {
      return { ok: false, comingSoon: true, zoneName: zone };
    }
  }
  return { ok: false, comingSoon: false };
}

export const INSURANCE_FEE = 1300;

export const PROMO_CODES: Record<string, number> = {
  KLOVA10: 10,
  WELCOME5: 5,
  NEWUSER: 15,
};

export const DEFAULT_BOOKING: BookingData = {
  service: null,
  bedrooms: null,
  frequency: null,
  recurringPattern: null,
  recurringMonths: 1,
  address: "",
  latitude: null,
  longitude: null,
  bookingDate: null,
  timeSlot: null,
  extras: {
    ironing: false,
    laundry: false,
    wardrobe: false,
    appliances: false,
    appliance_units: {
      oven: false,
      fridge: false,
      freezer: false,
      microwave: false,
      coffee_machine: false,
      toaster: false,
      custom: "",
    },
    cabinets: false,
    windows: false,
    fans: false,
    walls: false,
    compound: false,
  },
  hasPets: null,
  petDetails: "",
  notes: "",
  keeperCount: 1,
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  requestedCleanerId: null,
  payMonths: 1,
  wantsInsurance: true,
  promoCode: "",
};

export function computePrice(data: BookingData): PriceBreakdown {
  const service = SERVICES.find((s) => s.slug === data.service);
  const base = service && data.bedrooms ? service.pricing[data.bedrooms] : 0;

  const keeperSurcharge = (data.keeperCount - 1) * base;

  let extras = 0;
  const e = data.extras;
  if (e.ironing)   extras += 4600;
  if (e.laundry)   extras += 3500;
  if (e.wardrobe)  extras += 4000;
  if (e.appliances) {
    const boolCount = (["oven", "fridge", "freezer", "microwave", "coffee_machine", "toaster"] as const)
      .filter((k) => e.appliance_units[k]).length;
    const customCount = e.appliance_units.custom.trim() ? 1 : 0;
    extras += (boolCount + customCount) * 1500;
  }
  if (e.cabinets)  extras += 1500;
  if (e.windows)   extras += 2000;
  if (e.fans)      extras += 1600;
  if (e.walls)     extras += 2300;
  if (e.compound)  extras += 3000;

  const insurance = data.wantsInsurance ? INSURANCE_FEE : 0;

  const promo = PROMO_CODES[data.promoCode.toUpperCase()] ?? 0;
  // discount applied per-visit on the repeatable portion
  const perVisit = base + keeperSurcharge + extras;
  const discount = Math.round((perVisit * promo) / 100);
  const total = perVisit - discount + insurance;
  const monthlyTotal = (perVisit - discount + insurance) * data.payMonths;

  return { base, extras, keeperSurcharge, insurance, discount, total, monthlyTotal };
}

export function formatNGN(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}

// ─── Backend slug maps ────────────────────────────────────────────────────────
// The frontend uses short slugs; the DB was seeded with slightly different ones.
export const SERVICE_SLUG_TO_API: Record<string, string> = {
  "standard":         "standard",
  "deep":             "deep",
  "move-in-out":      "move-in-move-out",   // frontend slug ≠ DB slug
  "post-construction":"post-construction",
};

// Only the add-ons that exist in the DB (3 seeded rows).
// appliances/cabinets/windows/fans/walls/compound are UI-only until migrated.
const ADDON_SLUG_TO_API: Partial<Record<keyof typeof DEFAULT_BOOKING.extras, string>> = {
  laundry:  "laundry",
  ironing:  "ironing",
  wardrobe: "wardrobe-organising",  // frontend slug ≠ DB slug
};

// ─── Live-price compute (UX estimate only — backend is source of truth) ───────
export function computePriceFromLive(data: BookingData, live: LivePricingData): PriceBreakdown {
  const apiSlug = SERVICE_SLUG_TO_API[data.service ?? ""] ?? data.service;
  const liveService = live.services.find((s) => s.slug === apiSlug);
  const base = (liveService && data.bedrooms ? liveService.prices[data.bedrooms] : 0) ?? 0;

  const keeperSurcharge = (data.keeperCount - 1) * base;

  let extras = 0;
  const e = data.extras;
  const addonPrice = (slug: string) => live.addons.find((a) => a.slug === slug)?.amount ?? 0;
  if (e.ironing)   extras += addonPrice("ironing");
  if (e.laundry)   extras += addonPrice("laundry");
  if (e.wardrobe)  extras += addonPrice("wardrobe-organising");
  if (e.appliances) {
    const boolCount = (["oven", "fridge", "freezer", "microwave", "coffee_machine", "toaster"] as const)
      .filter((k) => e.appliance_units[k]).length;
    const customCount = e.appliance_units.custom.trim() ? 1 : 0;
    extras += (boolCount + customCount) * 1500;
  }
  if (e.cabinets) extras += 1500;
  if (e.windows)  extras += 2000;
  if (e.fans)     extras += 1600;
  if (e.walls)    extras += 2300;
  if (e.compound) extras += 3000;

  const insurance = data.wantsInsurance ? INSURANCE_FEE : 0;
  const promo = PROMO_CODES[data.promoCode.toUpperCase()] ?? 0;
  const perVisit = base + keeperSurcharge + extras;
  const discount = Math.round((perVisit * promo) / 100);
  const total = perVisit - discount + insurance;
  const monthlyTotal = (perVisit - discount + insurance) * data.payMonths;

  return { base, extras, keeperSurcharge, insurance, discount, total, monthlyTotal };
}

// ─── Build POST /bookings payload ─────────────────────────────────────────────
export function buildBookingPayload(data: BookingData) {
  const addonSlugs = (Object.entries(ADDON_SLUG_TO_API) as [keyof typeof ADDON_SLUG_TO_API, string][])
    .filter(([key]) => data.extras[key] as boolean)
    .map(([, apiSlug]) => apiSlug);

  return {
    first_name:           data.firstName,
    last_name:            data.lastName,
    phone:                data.phone,
    email:                data.email,
    address:              data.address,
    zone_slug:            "lekki-ajah",
    service_slug:         SERVICE_SLUG_TO_API[data.service ?? ""] ?? data.service,
    bedrooms:             data.bedrooms,
    addon_slugs:          addonSlugs,
    booking_date:         data.bookingDate,
    time_slot:            data.timeSlot ?? null,
    keeper_count:         data.keeperCount,
    wants_insurance:      data.wantsInsurance,
    requested_cleaner_id: data.requestedCleanerId ?? null,
    latitude:             data.latitude  ?? null,
    longitude:            data.longitude ?? null,
  };
}

export const FAKE_KEEPER = {
  firstName: "Chiamaka",
  lastName: "Okonkwo",
  photo: null as string | null,
  rating: 4.9,
  totalJobs: 187,
  ninVerified: true,
};
