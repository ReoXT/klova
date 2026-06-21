export type ServiceSlug = "standard" | "deep" | "move-in-out" | "post-construction";
export type BedroomCount = "1" | "2" | "3" | "4+";
export type FrequencyType = "one-off" | "recurring";
export type RecurringPattern = "weekly" | "biweekly" | "monthly";
export type TimeSlot = "7am–9am" | "9am–12pm" | "12pm–2pm" | "2pm–4pm";

export interface ApplianceSelection {
  oven: boolean;
  fridge: boolean;
  freezer: boolean;
  microwave: boolean;
  coffee_machine: boolean;
  toaster: boolean;
  custom: string; // name of an unlisted appliance, empty = not used
}

export interface ExtraSelections {
  ironing: boolean;
  laundry: boolean;
  wardrobe: boolean;
  appliances: boolean;
  appliance_units: ApplianceSelection;
  cabinets: boolean;
  windows: boolean;
  fans: boolean;
  walls: boolean;
  compound: boolean;
}

export interface BookingData {
  // Step 1 — service
  service: ServiceSlug | null;

  // Step 2 — apartment
  bedrooms: BedroomCount | null;
  frequency: FrequencyType | null;
  recurringPattern: RecurringPattern | null;
  recurringMonths: number;

  // Step 3 — address
  address: string;

  // Step 4 — date + time
  bookingDate: string | null; // YYYY-MM-DD
  timeSlot: TimeSlot | null;

  // Step 5 — extras
  extras: ExtraSelections;

  // Step 7 — preferences
  hasPets: boolean | null;
  petDetails: string;
  notes: string;
  keeperCount: number; // 1, 2, or 3

  // Step 8 — customer details
  firstName: string;
  lastName: string;
  phone: string;
  email: string;

  // Step 8b — returning customer keeper request (null = no preference)
  requestedCleanerId: string | null;

  // Step 10 — checkout
  payMonths: number; // 1–3
  wantsInsurance: boolean;
  promoCode: string;
}

export interface PriceBreakdown {
  base: number;
  extras: number;
  keeperSurcharge: number;
  insurance: number;
  discount: number;
  total: number;
  monthlyTotal: number; // total × payMonths
}

export interface ApiCleaner {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  rating: number | null;
  total_jobs: number;
}

export interface LivePricingData {
  services: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    prices: Record<string, number>; // bedrooms -> NGN
  }>;
  addons: Array<{
    id: string;
    name: string;
    slug: string;
    amount: number; // NGN
  }>;
}
