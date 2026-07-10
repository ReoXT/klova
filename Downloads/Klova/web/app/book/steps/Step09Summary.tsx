"use client";

import type { BookingData, PriceBreakdown } from "../types";
import { APPLIANCES, EXTRAS, SERVICES, formatNGN } from "../data";
import { Button } from "@/components/ui/Button";

interface Props {
  data: BookingData;
  price: PriceBreakdown;
  onNext: () => void;
  onBack: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs font-semibold uppercase tracking-widest mb-2"
      style={{ color: "var(--text-subtle)" }}
    >
      {children}
    </p>
  );
}

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
    : "-";

  const extrasLabel = selectedExtras
    .map((e) => {
      if (e.slug === "appliances") {
        const boolKeys = ["oven", "fridge", "freezer", "microwave", "coffee_machine", "toaster"] as const;
        const named = boolKeys
          .filter((k) => data.extras.appliance_units[k])
          .map((k) => APPLIANCES.find((a) => a.slug === k)?.name ?? k);
        const custom = data.extras.appliance_units.custom.trim();
        const all = [...named, custom].filter(Boolean);
        return all.length > 0 ? `${e.name} (${all.join(", ")})` : e.name;
      }
      return e.name;
    })
    .join(" · ");

  const perVisitNet = price.base + price.keeperSurcharge + price.extras - price.discount;
  const fullTotal = perVisitNet + price.insurance + price.transport;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-72">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
        Booking summary
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Review everything before you pay.
      </p>

      {/* Equipment notice */}
      <div
        className="rounded-xl px-4 py-3.5 mb-6 text-sm"
        style={{ background: "oklch(0.68 0.14 67 / 0.10)", color: "oklch(0.38 0.08 67)" }}
      >
        <p className="font-semibold mb-1">Your keeper brings no equipment</p>
        <p style={{ color: "oklch(0.45 0.07 67)" }}>
          Please have a broom, mop &amp; bucket, toilet brush, bin liners, all-purpose spray, and sponges ready at home.
        </p>
      </div>

      <div className="space-y-5">
        {/* Booking */}
        <div>
          <SectionLabel>Booking</SectionLabel>
          <p className="font-semibold text-base" style={{ color: "var(--text-strong)" }}>
            {service?.name ?? "-"}{data.bedrooms ? ` · ${data.bedrooms} bedroom${data.bedrooms === "1" ? "" : "s"}` : ""}
          </p>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-body)" }}>
            {data.frequency === "recurring"
              ? `${data.recurringPattern ? data.recurringPattern.charAt(0).toUpperCase() + data.recurringPattern.slice(1) : ""} recurring`
              : "One-off"}
            {data.keeperCount === 2 ? " · 2 keepers" : ""}
          </p>
          <p className="text-sm" style={{ color: "var(--text-body)" }}>
            {bookingDate}
          </p>
          {data.timeSlot && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {data.timeSlot} arrival
            </p>
          )}
        </div>

        {/* Address */}
        <div>
          <SectionLabel>Address</SectionLabel>
          <p className="text-sm" style={{ color: "var(--text-body)" }}>
            {data.address || "-"}
          </p>
        </div>

        {selectedExtras.length > 0 && (
          <div>
            <SectionLabel>Add-ons</SectionLabel>
            <p className="text-sm" style={{ color: "var(--text-body)" }}>
              {extrasLabel}
            </p>
          </div>
        )}

        {/* Contact */}
        <div>
          <SectionLabel>Contact</SectionLabel>
          <p className="font-semibold text-sm" style={{ color: "var(--text-strong)" }}>
            {data.firstName} {data.lastName}
          </p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {data.phone}
          </p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {data.email}
          </p>
        </div>
      </div>

      {/* Sticky footer */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30"
        style={{
          background: "var(--surface-card)",
          borderTop: "1px solid var(--border-default)",
          boxShadow: "0 -4px 24px oklch(0.18 0.007 85 / 0.08)",
        }}
      >
        <div className="max-w-lg mx-auto px-4 pt-4 pb-6">
          {/* Price rows */}
          <div className="space-y-1.5 text-sm mb-3">
            <div className="flex justify-between">
              <span style={{ color: "var(--text-muted)" }}>
                {price.keeperSurcharge > 0 ? "Base price (2 keepers)" : "Base price"}
              </span>
              <span style={{ color: "var(--text-body)" }}>
                {formatNGN(price.base + price.keeperSurcharge)}
              </span>
            </div>
            {price.extras > 0 && (
              <div className="flex justify-between">
                <span style={{ color: "var(--text-muted)" }}>Add-ons</span>
                <span style={{ color: "var(--text-body)" }}>{formatNGN(price.extras)}</span>
              </div>
            )}
            {price.insurance > 0 && (
              <div className="flex justify-between">
                <span style={{ color: "var(--text-muted)" }}>Insurance</span>
                <span style={{ color: "var(--text-body)" }}>{formatNGN(price.insurance)}</span>
              </div>
            )}
            {price.discount > 0 && (
              <div className="flex justify-between">
                <span style={{ color: "var(--klova-success)" }}>Discount</span>
                <span style={{ color: "var(--klova-success)" }}>−{formatNGN(price.discount)}</span>
              </div>
            )}
            {price.transport > 0 && (
              <div className="flex justify-between">
                <span style={{ color: "var(--text-muted)" }}>Transport estimate</span>
                <span style={{ color: "var(--text-body)" }}>{formatNGN(price.transport)}</span>
              </div>
            )}
          </div>

          {price.transport > 0 && (
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
              Transport covers your keeper's travel to your home and goes directly to them.
            </p>
          )}

          <div
            className="flex items-baseline justify-between py-3 mb-4"
            style={{ borderTop: "1px solid var(--border-default)" }}
          >
            <span className="font-semibold text-sm" style={{ color: "var(--text-strong)" }}>
              Total amount
            </span>
            <span className="text-xl font-bold" style={{ color: "var(--klova-accent)" }}>
              {formatNGN(fullTotal)}
            </span>
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={onBack} className="flex-1">Back</Button>
            <Button variant="primary" onClick={onNext} className="flex-1">
              Proceed to checkout
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
