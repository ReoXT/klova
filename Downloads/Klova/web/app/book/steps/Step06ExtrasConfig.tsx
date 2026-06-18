"use client";

import type { BookingData, ApplianceSelection } from "../types";
import { APPLIANCES, formatNGN } from "../data";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

interface Props {
  data: BookingData;
  patch: (p: Partial<BookingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step06ExtrasConfig({ data, patch, onBack, onNext }: Props) {
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

  const applianceCount = Object.values(data.extras.appliance_units).filter(Boolean).length;
  const canContinue = !data.extras.appliances || applianceCount > 0;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
        Customise your extras
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Select which appliances you want cleaned inside.
      </p>

      {/* Appliance interiors */}
      {data.extras.appliances && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium" style={{ color: "var(--text-body)" }}>
              Appliance interiors
            </p>
            <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
              ₦1,500 each · {applianceCount > 0 ? `${applianceCount} selected = ${formatNGN(applianceCount * 1500)}` : "none selected"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {APPLIANCES.map(({ slug, name }) => {
              const key = slug as keyof ApplianceSelection;
              const sel = data.extras.appliance_units[key];
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => toggleAppliance(key)}
                  className="rounded-xl p-3.5 border-2 flex items-center gap-2.5 text-left transition-all duration-150"
                  style={{
                    borderColor: sel ? "var(--klova-primary)" : "var(--border-default)",
                    background: sel ? "var(--klova-primary-soft)" : "var(--surface-card)",
                  }}
                >
                  <div
                    className="w-4.5 h-4.5 rounded border-2 flex items-center justify-center shrink-0"
                    style={{
                      borderColor: sel ? "var(--klova-primary)" : "var(--border-strong)",
                      background: sel ? "var(--klova-primary)" : "transparent",
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
                    className="text-sm font-medium"
                    style={{ color: sel ? "var(--klova-primary)" : "var(--text-body)" }}
                  >
                    {name}
                  </span>
                </button>
              );
            })}
          </div>
          {applianceCount === 0 && (
            <Alert variant="warning" className="mt-3">
              Select at least one appliance to include this add-on, or go back and uncheck it.
            </Alert>
          )}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <Button variant="ghost" onClick={onBack} className="flex-1">Back</Button>
        <Button variant="primary" onClick={onNext} disabled={!canContinue} className="flex-1">Continue</Button>
      </div>
    </div>
  );
}
