"use client";

import { useState } from "react";
import type { BookingData, PriceBreakdown } from "../types";
import { formatNGN } from "../data";
import { Button } from "@/components/ui/Button";
import { LocationPicker } from "@/components/ui/LocationPicker";

interface Props {
  data: BookingData;
  patch: (p: Partial<BookingData>) => void;
  price: PriceBreakdown;
  onNext: () => void;
  onBack: () => void;
}

export default function Step03Address({ data, patch, price, onNext, onBack }: Props) {
  // True only after the customer manually taps or drags the pin —
  // a geocode auto-drop does NOT set this.
  const [pinConfirmed, setPinConfirmed] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  const hasAddress  = data.address.trim().length >= 8;
  const hasPin      = data.latitude != null;
  // Both address AND manual pin interaction required to proceed
  const canContinue = hasAddress && hasPin && pinConfirmed;

  // Determine the inline hint the customer should see
  const hint: string | null = !hasAddress
    ? null  // no address yet — search box placeholder is enough
    : !hasPin
    ? "Drag the pin to your exact building to continue."
    : !pinConfirmed
    ? "Drag the pin to your exact building to confirm your location."
    : null;

  function handleNext() {
    if (!hasAddress) {
      setAddressError("Please enter your full address.");
      return;
    }
    if (canContinue) onNext();
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-40">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
        Where are we cleaning?
      </h1>
      <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
        Search your street name, select it, then <strong>drag the pin to your exact building</strong>.
        If your keeper can&apos;t find you, it&apos;ll delay your clean.
      </p>

      <LocationPicker
        lat={data.latitude}
        lng={data.longitude}
        onChange={(lat, lng) => patch({ latitude: lat, longitude: lng })}
        onQueryChange={(q) => { patch({ address: q }); setAddressError(null); }}
        onUserInteract={() => setPinConfirmed(true)}
        value={data.address}
        geocodeEndpoint="/api/booking/geocode"
        allowClear={false}
        showCoords={false}
      />

      {/* Address validation error */}
      {addressError && (
        <p className="text-xs text-error mt-2 flex items-center gap-1">
          <WarningIcon />
          {addressError}
        </p>
      )}

      {/* Pin confirmation nudge — only after an address is typed/selected */}
      {hint && !addressError && (
        <div
          className="flex items-start gap-2 rounded-xl px-3 py-2.5 mt-3 text-sm"
          style={{ background: "oklch(0.97 0.03 85)", color: "oklch(0.45 0.12 60)" }}
        >
          <WarningIcon className="mt-0.5 shrink-0" />
          <span>{hint}</span>
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
              <span className="text-xl font-bold" style={{ color: "var(--klova-accent)" }}>
                {formatNGN(price.total - price.insurance)}
              </span>
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onBack} className="flex-1">Back</Button>
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={!canContinue}
              className="flex-1"
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WarningIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`w-4 h-4 ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}
