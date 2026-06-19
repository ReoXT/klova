"use client";

import type { BookingData, PriceBreakdown, ExtraSelections } from "../types";
import { EXTRAS, formatNGN } from "../data";
import { Button } from "@/components/ui/Button";

interface Props {
  data: BookingData;
  patch: (p: Partial<BookingData>) => void;
  price: PriceBreakdown;
  onNext: () => void;
  onBack: () => void;
}

export default function Step05Extras({ data, patch, price, onNext, onBack }: Props) {
  function toggle(slug: string) {
    const key = slug as keyof ExtraSelections;
    const current = data.extras[key] as boolean;
    patch({
      extras: {
        ...data.extras,
        [key]: !current,
        ...(slug === "appliances" && current
          ? {
              appliance_units: {
                oven: false, fridge: false, freezer: false,
                microwave: false, coffee_machine: false, toaster: false,
                custom: "",
              },
            }
          : {}),
      },
    });
  }

  const selectedCount = EXTRAS.filter(({ slug }) => {
    const key = slug as keyof ExtraSelections;
    return data.extras[key] as boolean;
  }).length;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
        Any extras?
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        These are added on top of your clean. All optional.
      </p>

      <div className="flex flex-col gap-2.5">
        {EXTRAS.map(({ slug, name }) => {
          const key = slug as keyof ExtraSelections;
          const selected = data.extras[key] as boolean;
          return (
            <button
              key={slug}
              type="button"
              onClick={() => toggle(slug)}
              className="w-full text-left rounded-xl px-4 py-3.5 border-2 flex items-center gap-3 transition-all duration-150"
              style={{
                borderColor: selected ? "var(--klova-accent)" : "var(--border-default)",
                background: selected ? "var(--klova-accent-soft)" : "var(--surface-card)",
              }}
            >
              {/* Checkbox */}
              <div
                className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all"
                style={{
                  borderColor: selected ? "var(--klova-accent)" : "var(--border-strong)",
                  background: selected ? "var(--klova-accent)" : "transparent",
                }}
              >
                {selected && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>

              <p className="font-semibold text-base" style={{ color: selected ? "var(--klova-primary)" : "var(--text-strong)" }}>
                {name}
              </p>
            </button>
          );
        })}
      </div>

      {selectedCount > 0 && (
        <p className="text-xs mt-3 text-center" style={{ color: "var(--text-subtle)" }}>
          {selectedCount} add-on{selectedCount > 1 ? "s" : ""} selected
        </p>
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
            <Button variant="primary" onClick={onNext} className="flex-1">
              {selectedCount === 0 ? "Skip" : "Continue"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
