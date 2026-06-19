"use client";

import type { BookingData, PriceBreakdown, BedroomCount, FrequencyType, RecurringPattern } from "../types";
import { formatNGN } from "../data";
import { Button } from "@/components/ui/Button";

interface Props {
  data: BookingData;
  patch: (p: Partial<BookingData>) => void;
  price: PriceBreakdown;
  onNext: () => void;
  onBack: () => void;
}

const BEDROOMS: { value: BedroomCount; label: string }[] = [
  { value: "1", label: "1 Bedroom" },
  { value: "2", label: "2 Bedrooms" },
  { value: "3", label: "3 Bedrooms" },
  { value: "4+", label: "4+ Bedrooms" },
];

const PATTERNS: { value: RecurringPattern; label: string; desc: string }[] = [
  { value: "weekly",   label: "Weekly",    desc: "Every week on the same day" },
  { value: "biweekly", label: "Bi-weekly", desc: "Every two weeks" },
  { value: "monthly",  label: "Monthly",   desc: "Once a month" },
];

export default function Step02Size({ data, patch, price, onNext, onBack }: Props) {
  const canContinue = !!data.bedrooms && !!data.frequency &&
    (data.frequency === "one-off" || !!data.recurringPattern);

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
        Your apartment
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Helps us match the right keeper and set the price.
      </p>

      {/* Bedroom count */}
      <p className="text-sm font-medium mb-2" style={{ color: "var(--text-body)" }}>
        How many bedrooms?
      </p>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {BEDROOMS.map(({ value, label }) => {
          const sel = data.bedrooms === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => patch({ bedrooms: value })}
              className="rounded-xl p-3.5 border-2 text-center font-semibold text-base transition-all duration-150"
              style={{
                borderColor: sel ? "var(--klova-accent)" : "var(--border-default)",
                background: sel ? "var(--klova-accent-soft)" : "var(--surface-card)",
                color: sel ? "var(--klova-primary)" : "var(--text-body)",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Frequency */}
      <p className="text-sm font-medium mb-2" style={{ color: "var(--text-body)" }}>
        How often?
      </p>
      <div className="flex flex-col gap-3 mb-4">
        {(["one-off", "recurring"] as FrequencyType[]).map((freq) => {
          const sel = data.frequency === freq;
          return (
            <button
              key={freq}
              type="button"
              onClick={() => patch({ frequency: freq, recurringPattern: freq === "one-off" ? null : data.recurringPattern })}
              className="w-full text-left rounded-xl p-4 border-2 transition-all duration-150"
              style={{
                borderColor: sel ? "var(--klova-accent)" : "var(--border-default)",
                background: sel ? "var(--klova-accent-soft)" : "var(--surface-card)",
              }}
            >
              <p className="font-semibold text-base" style={{ color: sel ? "var(--klova-primary)" : "var(--text-strong)" }}>
                {freq === "one-off" ? "One-off" : "Recurring"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {freq === "one-off"
                  ? "A single clean whenever you need it"
                  : "Regular cleans, we keep the same keeper for you"}
              </p>
            </button>
          );
        })}
      </div>

      {/* Recurring pattern */}
      {data.frequency === "recurring" && (
        <div className="mt-4">
          <p className="text-sm font-medium mb-2" style={{ color: "var(--text-body)" }}>
            How often should they come?
          </p>
          <div className="flex flex-col gap-2">
            {PATTERNS.map(({ value, label, desc }) => {
              const sel = data.recurringPattern === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => patch({ recurringPattern: value })}
                  className="w-full text-left rounded-xl px-4 py-3 border-2 flex items-center gap-3 transition-all duration-150"
                  style={{
                    borderColor: sel ? "var(--klova-accent)" : "var(--border-default)",
                    background: sel ? "var(--klova-accent-soft)" : "var(--surface-card)",
                  }}
                >
                  <div
                    className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={{ borderColor: sel ? "var(--klova-accent)" : "var(--border-strong)" }}
                  >
                    {sel && (
                      <div className="w-2 h-2 rounded-full" style={{ background: "var(--klova-accent)" }} />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-base" style={{ color: sel ? "var(--klova-primary)" : "var(--text-strong)" }}>
                      {label}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{desc}</p>
                  </div>
                </button>
              );
            })}
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
            <Button variant="primary" onClick={onNext} disabled={!canContinue} className="flex-1">Continue</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
