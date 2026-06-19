"use client";

import type { BookingData, PriceBreakdown, ServiceSlug } from "../types";
import { SERVICES, formatNGN } from "../data";
import { Button } from "@/components/ui/Button";

interface Props {
  data: BookingData;
  patch: (p: Partial<BookingData>) => void;
  price: PriceBreakdown;
  onNext: () => void;
}

export default function Step01Service({ data, patch, price, onNext }: Props) {
  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
        What type of clean?
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Choose the service that fits your home.
      </p>

      <div className="flex flex-col gap-3">
        {SERVICES.map((svc) => {
          const selected = data.service === svc.slug;
          return (
            <button
              key={svc.slug}
              type="button"
              aria-pressed={selected}
              onClick={() => patch({ service: svc.slug as ServiceSlug })}
              className="w-full text-left rounded-xl p-4 border-2 transition-all duration-150"
              style={{
                borderColor: selected ? "var(--klova-accent)" : "var(--border-default)",
                background: selected ? "var(--klova-accent-soft)" : "var(--surface-card)",
                boxShadow: selected ? "var(--shadow-sm)" : "none",
              }}
            >
              <p
                className="font-semibold text-base"
                style={{ color: selected ? "var(--klova-primary)" : "var(--text-strong)" }}
              >
                {svc.name}
              </p>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                {svc.description}
              </p>
            </button>
          );
        })}
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
          <Button variant="primary" className="w-full" disabled={!data.service} onClick={onNext}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
