"use client";

import type { BookingData } from "../types";
import type { PriceBreakdown } from "../types";
import { SERVICES, EXTRAS, APPLIANCES, formatNGN } from "../data";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

interface Props {
  data: BookingData;
  price: PriceBreakdown;
  onNext: () => void;
  onBack: () => void;
}

const EQUIPMENT = [
  "Broom and dustpan",
  "Mop and bucket",
  "Bin liners",
  "Toilet brush",
  "All-purpose spray cleaner",
  "Sponges and scrubbing pads",
  "Rubber gloves",
];

export default function Step09Summary({ data, price, onNext, onBack }: Props) {
  const service = SERVICES.find((s) => s.slug === data.service);
  const selectedExtras = EXTRAS.filter(
    (e) => data.extras[e.slug as keyof typeof data.extras] as boolean
  );

  const bookingDate = data.bookingDate
    ? new Date(data.bookingDate + "T00:00:00").toLocaleDateString("en-NG", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
        Booking summary
      </h1>
      <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
        Review everything before you pay.
      </p>

      {/* Equipment alert */}
      <Alert variant="warning" className="mb-5">
        <p className="font-semibold">Your keeper brings no equipment</p>
        <p className="mt-1">Please make sure these items are available at home:</p>
        <ul className="mt-1.5 space-y-0.5 list-disc list-inside">
          {EQUIPMENT.map((item) => (
            <li key={item} className="text-xs">{item}</li>
          ))}
        </ul>
      </Alert>

      {/* Summary card */}
      <div
        className="rounded-2xl border divide-y text-sm"
        style={{ borderColor: "var(--border-default)" }}
      >
        {/* Service */}
        <Row label="Service">{service?.name ?? "—"}</Row>
        <Row label="Apartment">{data.bedrooms ? `${data.bedrooms} bedroom${data.bedrooms === "1" ? "" : "s"}` : "—"}</Row>
        <Row label="Frequency">
          {data.frequency === "recurring"
            ? `Recurring · ${data.recurringPattern ?? ""}`
            : "One-off"}
        </Row>
        <Row label="Date">{bookingDate}</Row>
        <Row label="Time">{data.timeSlot ?? "—"}</Row>
        <Row label="Address">{data.address || "—"}</Row>
        <Row label="Keepers">{data.keeperCount}</Row>

        {selectedExtras.length > 0 && (
          <Row label="Add-ons">
            <span className="text-right">
              {selectedExtras.map((e) => {
                if (e.slug === "appliances") {
                  const units = APPLIANCES.filter(
                    (a) => data.extras.appliance_units[a.slug as keyof typeof data.extras.appliance_units]
                  );
                  return units.length > 0
                    ? `${e.name} (${units.map((u) => u.name).join(", ")})`
                    : e.name;
                }
                return e.name;
              }).join(" · ")}
            </span>
          </Row>
        )}

        {/* Divider before price */}
        <div style={{ borderTop: `1px solid var(--border-default)` }} />

        <Row label="Base price">{formatNGN(price.base)}</Row>
        {price.keeperSurcharge > 0 && <Row label={`+${data.keeperCount - 1} extra keeper${data.keeperCount > 2 ? "s" : ""}`}>{formatNGN(price.keeperSurcharge)}</Row>}
        {price.extras > 0 && <Row label="Add-ons">{formatNGN(price.extras)}</Row>}

        {/* Total */}
        <div className="px-4 py-3 flex items-center justify-between">
          <p className="font-semibold" style={{ color: "var(--text-strong)" }}>Total</p>
          <p className="font-bold text-base" style={{ color: "var(--klova-accent)" }}>
            {formatNGN(price.total)}
          </p>
        </div>
      </div>

      {/* Customer */}
      <div
        className="mt-4 rounded-xl border px-4 py-3 text-sm"
        style={{ borderColor: "var(--border-default)" }}
      >
        <p className="font-medium mb-1" style={{ color: "var(--text-body)" }}>
          {data.firstName} {data.lastName}
        </p>
        <p style={{ color: "var(--text-muted)" }}>{data.phone}</p>
        <p style={{ color: "var(--text-muted)" }}>{data.email}</p>
      </div>

      <div className="flex gap-3 mt-6">
        <Button variant="ghost" onClick={onBack} className="flex-1">Back</Button>
        <Button variant="primary" onClick={onNext} className="flex-1">Proceed to checkout</Button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 flex items-start justify-between gap-3">
      <p style={{ color: "var(--text-muted)", flexShrink: 0 }}>{label}</p>
      <p className="font-medium text-right" style={{ color: "var(--text-body)" }}>
        {children}
      </p>
    </div>
  );
}
