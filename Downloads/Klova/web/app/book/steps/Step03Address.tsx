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
  const [pinConfirmed, setPinConfirmed] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm]   = useState(false);

  const hasAddress  = data.address.trim().length >= 8;
  const hasPin      = data.latitude != null;
  const canContinue = hasAddress && hasPin && pinConfirmed;

  const hint: string | null = !hasAddress
    ? null
    : !hasPin
    ? "Drag the pin to your exact building to continue."
    : !pinConfirmed
    ? "Drag the pin to your exact building to confirm your location."
    : null;

  function handleNext() {
    if (!hasAddress) { setAddressError("Please enter your full address."); return; }
    if (canContinue) setShowConfirm(true);
  }

  function handleConfirm() {
    setShowConfirm(false);
    onNext();
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

      {addressError && (
        <p className="text-xs text-error mt-2 flex items-center gap-1">
          <WarningIcon />
          {addressError}
        </p>
      )}

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

      {/* Address confirmation sheet */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "oklch(0.1 0 0 / 0.55)" }}
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl px-6 pt-6 pb-10"
            style={{ background: "var(--surface-card)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "var(--border-default)" }} />

            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "oklch(0.94 0.06 145)" }}
            >
              <LocationIcon />
            </div>

            <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
              Is this your correct address?
            </h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
              Your keeper will use this to find you. If it&apos;s wrong, they could get lost on the day.
            </p>

            {/* Address display */}
            <div
              className="flex items-start gap-3 rounded-2xl px-4 py-3 mb-6"
              style={{ background: "var(--surface-subtle)", border: "1px solid var(--border-default)" }}
            >
              <PinIcon />
              <p className="text-sm font-medium leading-snug" style={{ color: "var(--text-strong)" }}>
                {data.address}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button variant="primary" wide onClick={handleConfirm}>
                Yes, that&apos;s correct — continue
              </Button>
              <Button variant="ghost" wide onClick={() => setShowConfirm(false)}>
                No, let me adjust
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WarningIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="oklch(0.45 0.15 145)" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      style={{ color: "var(--klova-primary)" }}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
  );
}
