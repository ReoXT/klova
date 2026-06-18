"use client";

import type { BookingData, ExtraSelections } from "../types";
import { EXTRAS, formatNGN } from "../data";
import { Button } from "@/components/ui/Button";

interface Props {
  data: BookingData;
  patch: (p: Partial<BookingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step05Extras({ data, patch, onNext, onBack }: Props) {
  function toggle(slug: string) {
    const key = slug as keyof ExtraSelections;
    const current = data.extras[key] as boolean;
    patch({
      extras: {
        ...data.extras,
        [key]: !current,
        // if un-toggling appliances, reset units
        ...(slug === "appliances" && current
          ? {
              appliance_units: {
                oven: false, fridge: false, freezer: false,
                microwave: false, coffee_machine: false, toaster: false,
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
        {EXTRAS.map(({ slug, name, price, description, perUnit }) => {
          const key = slug as keyof ExtraSelections;
          const selected = data.extras[key] as boolean;
          return (
            <button
              key={slug}
              type="button"
              onClick={() => toggle(slug)}
              className="w-full text-left rounded-xl p-4 border-2 flex items-start gap-3 transition-all duration-150"
              style={{
                borderColor: selected ? "var(--klova-primary)" : "var(--border-default)",
                background: selected ? "var(--klova-primary-soft)" : "var(--surface-card)",
              }}
            >
              {/* Checkbox */}
              <div
                className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all"
                style={{
                  borderColor: selected ? "var(--klova-primary)" : "var(--border-strong)",
                  background: selected ? "var(--klova-primary)" : "transparent",
                }}
              >
                {selected && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm" style={{ color: selected ? "var(--klova-primary)" : "var(--text-strong)" }}>
                    {name}
                  </p>
                  <span
                    className="text-xs font-semibold shrink-0"
                    style={{ color: selected ? "var(--klova-accent)" : "var(--text-muted)" }}
                  >
                    {perUnit ? `${formatNGN(price)}/item` : formatNGN(price)}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {selectedCount > 0 && (
        <p className="text-xs mt-3 text-center" style={{ color: "var(--text-subtle)" }}>
          {selectedCount} add-on{selectedCount > 1 ? "s" : ""} selected
          {data.extras.appliances && " — you'll customise appliances on the next screen"}
        </p>
      )}

      <div className="flex gap-3 mt-6">
        <Button variant="ghost" onClick={onBack} className="flex-1">Back</Button>
        <Button variant="primary" onClick={onNext} className="flex-1">
          {selectedCount === 0 ? "Skip" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
