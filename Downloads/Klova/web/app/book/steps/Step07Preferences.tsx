"use client";

import { useState } from "react";
import type { BookingData, PriceBreakdown } from "../types";
import { formatNGN } from "../data";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

interface Props {
  data: BookingData;
  patch: (p: Partial<BookingData>) => void;
  price: PriceBreakdown;
  onNext: () => void;
  onBack: () => void;
}

export default function Step07Preferences({ data, patch, price, onNext, onBack }: Props) {
  const [error, setError] = useState<string | null>(null);

  function handleNext() {
    if (data.hasPets === null) {
      setError("Please let us know if you have pets at home.");
      return;
    }
    onNext();
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
        A few preferences
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Help your keeper prepare for a smooth visit.
      </p>

      {/* Pets */}
      <div className="mb-6">
        <p className="text-sm font-medium mb-3" style={{ color: "var(--text-body)" }}>
          Do you have pets at home?
        </p>
        <div className="flex gap-3">
          {([true, false] as const).map((val) => {
            const sel = data.hasPets === val;
            return (
              <button
                key={String(val)}
                type="button"
                onClick={() => { patch({ hasPets: val }); setError(null); }}
                className="flex-1 rounded-xl border-2 py-3 text-base font-semibold transition-all duration-150"
                style={{
                  borderColor: sel ? "var(--klova-accent)" : "var(--border-default)",
                  background: sel ? "var(--klova-accent-soft)" : "var(--surface-card)",
                  color: sel ? "var(--klova-primary)" : "var(--text-body)",
                }}
              >
                {val ? "Yes" : "No"}
              </button>
            );
          })}
        </div>
        {error && (
          <p className="text-xs text-error mt-1.5">{error}</p>
        )}
        {data.hasPets && (
          <div className="mt-3">
            <label
              htmlFor="pet-details"
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--text-muted)" }}
            >
              Any details about your pet(s)? (optional)
            </label>
            <input
              id="pet-details"
              type="text"
              placeholder="e.g. One dog who loves cuddles"
              value={data.petDetails}
              onChange={(e) => patch({ petDetails: e.target.value })}
              className="input w-full text-sm"
            />
          </div>
        )}
      </div>

      {/* Extra keeper — Yes/No */}
      <div className="mb-6">
        <p className="text-sm font-medium mb-1" style={{ color: "var(--text-body)" }}>
          Do you need an extra keeper?
        </p>
        <div className="flex gap-3">
          {([true, false] as const).map((want) => {
            const sel = want ? data.keeperCount === 2 : data.keeperCount === 1;
            return (
              <button
                key={String(want)}
                type="button"
                onClick={() => patch({ keeperCount: want ? 2 : 1 })}
                className="flex-1 rounded-xl border-2 py-3 text-base font-semibold transition-all duration-150"
                style={{
                  borderColor: sel ? "var(--klova-accent)" : "var(--border-default)",
                  background: sel ? "var(--klova-accent-soft)" : "var(--surface-card)",
                  color: sel ? "var(--klova-primary)" : "var(--text-body)",
                }}
              >
                {want ? "Yes" : "No"}
              </button>
            );
          })}
        </div>
        {data.keeperCount === 2 && (
          <Alert variant="info" className="mt-3">
            2 keepers requested — your base clean price will be doubled.
          </Alert>
        )}
      </div>

      {/* Notes */}
      <div className="mb-6">
        <label
          htmlFor="notes"
          className="block text-sm font-medium mb-1.5"
          style={{ color: "var(--text-body)" }}
        >
          Anything else your keeper should know?{" "}
          <span style={{ color: "var(--text-subtle)" }}>(optional)</span>
        </label>
        <textarea
          id="notes"
          rows={3}
          placeholder="e.g. Gate code is 1234. Please use the back entrance."
          value={data.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          className="textarea w-full resize-none text-sm"
        />
        <p className="text-xs mt-1" style={{ color: "var(--text-subtle)" }}>
          {data.notes.length}/300 characters
        </p>
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
              <span className="text-xl font-bold" style={{ color: "var(--klova-accent)" }}>{formatNGN(price.total)}</span>
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onBack} className="flex-1">Back</Button>
            <Button variant="primary" onClick={handleNext} className="flex-1">Continue</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
