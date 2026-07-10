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
  const [touched, setTouched] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  function handleNext() {
    setTouched(true);
    if (data.address.trim().length < 8) {
      setAddressError("Please enter your full address.");
      return;
    }
    onNext();
  }

  const noPin = touched && data.latitude == null;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-40">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
        Where are we cleaning?
      </h1>
      <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
        Search your address then drag the pin to your exact spot. We serve Lekki and Ajah.
      </p>

      <LocationPicker
        lat={data.latitude}
        lng={data.longitude}
        onChange={(lat, lng) => patch({ latitude: lat, longitude: lng })}
        onQueryChange={(q) => { patch({ address: q }); setAddressError(null); }}
        value={data.address}
        geocodeEndpoint="/api/booking/geocode"
        allowClear={false}
      />

      {addressError && (
        <p className="text-xs text-error mt-2 flex items-center gap-1">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {addressError}
        </p>
      )}

      {noPin && !addressError && (
        <div className="alert alert-soft alert-warning text-xs py-2 mt-2">
          No pin set yet — tap the map to drop one so your keeper finds you easily.
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
            <Button variant="primary" onClick={handleNext} className="flex-1">Continue</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
