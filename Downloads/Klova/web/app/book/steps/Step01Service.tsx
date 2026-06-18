"use client";

import type { BookingData, ServiceSlug } from "../types";
import { SERVICES } from "../data";
import { Button } from "@/components/ui/Button";

interface Props {
  data: BookingData;
  patch: (p: Partial<BookingData>) => void;
  onNext: () => void;
}

export default function Step01Service({ data, patch, onNext }: Props) {
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
              onClick={() => patch({ service: svc.slug as ServiceSlug })}
              className="w-full text-left rounded-xl p-4 border-2 transition-all duration-150"
              style={{
                borderColor: selected ? "var(--klova-primary)" : "var(--border-default)",
                background: selected ? "var(--klova-primary-soft)" : "var(--surface-card)",
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

      <div className="mt-6">
        <Button
          variant="primary"
          className="w-full"
          disabled={!data.service}
          onClick={onNext}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
