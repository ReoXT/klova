"use client";

import type { BookingData, PriceBreakdown, ApplianceSelection } from "../types";
import { APPLIANCES, formatNGN } from "../data";
import { Button } from "@/components/ui/Button";

interface Props {
  data: BookingData;
  patch: (p: Partial<BookingData>) => void;
  price: PriceBreakdown;
  onNext: () => void;
  onBack: () => void;
}

export default function Step06ExtrasConfig({ data, patch, price, onBack, onNext }: Props) {
  function toggleAppliance(slug: keyof ApplianceSelection) {
    patch({
      extras: {
        ...data.extras,
        appliance_units: {
          ...data.extras.appliance_units,
          [slug]: !data.extras.appliance_units[slug],
        },
      },
    });
  }

  function setCustom(val: string) {
    patch({
      extras: {
        ...data.extras,
        appliance_units: {
          ...data.extras.appliance_units,
          custom: val,
        },
      },
    });
  }

  const boolKeys = ["oven", "fridge", "freezer", "microwave", "coffee_machine", "toaster"] as const;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
        Which appliances?
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Select the appliances you want cleaned inside.
      </p>

      {data.extras.appliances && (
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            {APPLIANCES.map(({ slug, name }) => {
              const key = slug as keyof ApplianceSelection;
              const sel = !!data.extras.appliance_units[key];
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => toggleAppliance(key)}
                  className="rounded-xl p-3.5 border-2 flex items-center gap-2.5 text-left transition-all duration-150"
                  style={{
                    borderColor: sel ? "var(--klova-accent)" : "var(--border-default)",
                    background: sel ? "var(--klova-accent-soft)" : "var(--surface-card)",
                  }}
                >
                  <div
                    className="rounded border-2 flex items-center justify-center shrink-0"
                    style={{
                      borderColor: sel ? "var(--klova-accent)" : "var(--border-strong)",
                      background: sel ? "var(--klova-accent)" : "transparent",
                      width: "1.125rem",
                      height: "1.125rem",
                    }}
                  >
                    {sel && (
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span
                    className="text-base font-semibold"
                    style={{ color: sel ? "var(--klova-primary)" : "var(--text-body)" }}
                  >
                    {name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Custom appliance */}
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: "var(--border-default)", background: "var(--surface-section)" }}
          >
            <label
              htmlFor="custom-appliance"
              className="block text-sm font-semibold mb-1.5"
              style={{ color: "var(--text-body)" }}
            >
              Got one that&apos;s not listed?
            </label>
            <input
              id="custom-appliance"
              type="text"
              placeholder="e.g. Ice maker, wine cooler, juicer..."
              value={data.extras.appliance_units.custom}
              onChange={(e) => setCustom(e.target.value)}
              className="input w-full text-sm"
            />
          </div>

        </div>
      )}

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
          {price.base > 0 && (
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text-strong)" }}>Total amount</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {data.keeperCount === 2 ? "2 keepers" : "1 keeper"}
                  {data.bedrooms ? ` · ${data.bedrooms} bed${data.bedrooms === "1" ? "" : "s"}` : ""}
                </p>
              </div>
              <span className="text-xl font-bold" style={{ color: "var(--klova-accent)" }}>{formatNGN(price.total - price.insurance)}</span>
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onBack} className="flex-1">Back</Button>
            <Button variant="primary" onClick={onNext} className="flex-1">Continue</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
