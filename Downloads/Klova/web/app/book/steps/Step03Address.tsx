"use client";

import { useState } from "react";
import type { BookingData } from "../types";
import { validateAddress } from "../data";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

interface Props {
  data: BookingData;
  patch: (p: Partial<BookingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step03Address({ data, patch, onNext, onBack }: Props) {
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comingSoon, setComingSoon] = useState<string | null>(null);

  function handleChange(val: string) {
    patch({ address: val });
    if (touched) validate(val);
  }

  function validate(val: string): boolean {
    setComingSoon(null);
    setError(null);
    if (!val.trim() || val.trim().length < 10) {
      setError("Please enter your full address.");
      return false;
    }
    const result = validateAddress(val);
    if (result.ok) return true;
    if (result.comingSoon) {
      setComingSoon(result.zoneName);
      return false;
    }
    setError("We can't find this address in our service area.");
    return false;
  }

  function handleNext() {
    setTouched(true);
    if (validate(data.address)) onNext();
  }

  const addressOk = touched && !error && !comingSoon && data.address.trim().length >= 10 && validateAddress(data.address).ok;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
        Where are we cleaning?
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        We currently serve Lekki and Ajah. Enter your full address to confirm coverage.
      </p>

      <div className="mb-2">
        <label
          htmlFor="address"
          className="block text-sm font-medium mb-1.5"
          style={{ color: "var(--text-body)" }}
        >
          Full address
        </label>
        <textarea
          id="address"
          rows={3}
          placeholder="e.g. 14 Admiralty Way, Lekki Phase 1, Lagos"
          value={data.address}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => {
            setTouched(true);
            validate(data.address);
          }}
          className={[
            "textarea w-full resize-none",
            error ? "textarea-error" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ minHeight: "5rem" }}
        />
        {error && !comingSoon && (
          <p className="text-xs mt-1 text-error flex items-center gap-1">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </p>
        )}
      </div>

      {comingSoon && (
        <Alert variant="warning" className="mt-3">
          <p className="font-medium">
            {comingSoon} isn&apos;t covered yet
          </p>
          <p className="mt-0.5">
            We&apos;re launching in {comingSoon} soon — leave your email and we&apos;ll let you know the moment we&apos;re live there.
          </p>
        </Alert>
      )}

      {addressOk && (
        <Alert variant="success" className="mt-3">
          <span className="font-medium">Great news — we serve this area!</span> Your keeper will come to you.
        </Alert>
      )}

      {/* Zone coverage info */}
      <div
        className="mt-4 rounded-xl p-4 text-sm"
        style={{ background: "var(--surface-section)", color: "var(--text-muted)" }}
      >
        <p className="font-medium mb-1.5" style={{ color: "var(--text-body)" }}>
          Where we operate
        </p>
        <ul className="space-y-1">
          {[
            { name: "Lekki / Ajah", active: true },
            { name: "Victoria Island", active: false },
            { name: "Ikeja", active: false },
            { name: "Surulere", active: false },
          ].map(({ name, active }) => (
            <li key={name} className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: active ? "var(--klova-success)" : "var(--border-strong)" }}
              />
              <span style={{ color: active ? "var(--text-body)" : "var(--text-subtle)" }}>
                {name} {!active && <span className="text-xs">(coming soon)</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-3 mt-6">
        <Button variant="ghost" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button variant="primary" onClick={handleNext} className="flex-1">
          Continue
        </Button>
      </div>
    </div>
  );
}
