// Privacy-safe, coarse location shown in the jobs list and pre-confirmation
// detail view (the full street address is withheld until the booking is
// confirmed). Drops the first comma-segment of the free-text address, which
// is where the house number/street conventionally sits, and shows the rest.
// Falls back to the zone name when the address has no comma to split on,
// rather than risking exposure of an unparsed street address.
export function deriveArea(address: string, zoneName: string): string {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return zoneName;
  return parts.slice(1).join(", ");
}

export const TIME_SLOT_ORDER = ["7am–9am", "9am–12pm", "12pm–2pm", "2pm–4pm"] as const;

// A booking's full street address is only shown to the assigned keeper once
// it reaches one of these statuses — before that, only the coarse area
// (deriveArea above) is shown, in both the jobs list and the detail view.
export const ADDRESS_VISIBLE_STATUSES = new Set(["confirmed", "completed"]);

export function timeSlotRank(slot: string | null): number {
  if (!slot) return TIME_SLOT_ORDER.length;
  const idx = (TIME_SLOT_ORDER as readonly string[]).indexOf(slot);
  return idx === -1 ? TIME_SLOT_ORDER.length : idx;
}
