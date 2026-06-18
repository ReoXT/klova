"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import type { BookingData } from "../types";
import { validateAddress } from "../data";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Skeleton";

interface Props {
  data: BookingData;
  patch: (p: Partial<BookingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface Prediction {
  description: string;
  placeId: string;
}

// Singleton — load once across re-mounts
let autocompleteService: google.maps.places.AutocompleteService | null = null;
let loaderPromise: Promise<void> | null = null;

function loadPlaces(apiKey: string): Promise<void> {
  if (loaderPromise) return loaderPromise;
  setOptions({ key: apiKey, v: "weekly" });
  loaderPromise = importLibrary("places").then(() => {
    autocompleteService = new google.maps.places.AutocompleteService();
  });
  return loaderPromise;
}

export default function Step03Address({ data, patch, onNext, onBack }: Props) {
  const [query, setQuery] = useState(data.address);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

  // Load Maps SDK once
  useEffect(() => {
    if (!apiKey) return;
    loadPlaces(apiKey).then(() => setMapsReady(true));
  }, [apiKey]);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const fetchPredictions = useCallback(
    (input: string) => {
      if (!mapsReady || !autocompleteService || input.length < 3) {
        setPredictions([]);
        return;
      }
      autocompleteService.getPlacePredictions(
        {
          input,
          componentRestrictions: { country: "ng" },
          types: ["geocode", "establishment"],
        },
        (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            setPredictions(
              results.map((r) => ({ description: r.description, placeId: r.place_id }))
            );
            setOpen(true);
          } else {
            setPredictions([]);
          }
        }
      );
    },
    [mapsReady]
  );

  function handleInput(val: string) {
    setQuery(val);
    patch({ address: val });
    setError(null);
    setComingSoon(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(val), 320);
  }

  function selectPrediction(desc: string) {
    setQuery(desc);
    patch({ address: desc });
    setPredictions([]);
    setOpen(false);
    setTouched(true);
    runValidation(desc);
  }

  function runValidation(val: string): boolean {
    setError(null);
    setComingSoon(null);
    const trimmed = val.trim();
    if (trimmed.length < 8) {
      setError("Please enter your full address.");
      return false;
    }
    const result = validateAddress(trimmed);
    if (result.ok) return true;
    if (result.comingSoon) {
      setComingSoon(result.zoneName);
      return false;
    }
    setError("We don't currently serve this area. Try a Lekki or Ajah address.");
    return false;
  }

  function handleNext() {
    setTouched(true);
    if (runValidation(query)) onNext();
  }

  const addressOk =
    touched && !error && !comingSoon && validateAddress(query.trim()).ok;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
        Where are we cleaning?
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        We currently serve Lekki and Ajah. Enter your address to confirm.
      </p>

      {/* Autocomplete combobox */}
      <div ref={containerRef} className="relative mb-4">
        <label
          htmlFor="address-input"
          className="block text-sm font-medium mb-1.5"
          style={{ color: "var(--text-body)" }}
        >
          Your address
        </label>

        <div className="relative">
          <input
            id="address-input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. 14 Admiralty Way, Lekki Phase 1"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onBlur={() => {
              setTimeout(() => setOpen(false), 150);
              setTouched(true);
              if (query.trim().length >= 8) runValidation(query);
            }}
            onFocus={() => predictions.length > 0 && setOpen(true)}
            className={[
              "input w-full pr-10",
              error ? "input-error" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          />

          {/* Icon slot */}
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {!mapsReady && apiKey ? (
              <Spinner size="xs" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                style={{ color: "var(--text-subtle)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </span>
        </div>

        {/* Dropdown */}
        {open && predictions.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-50 w-full mt-1 rounded-xl border overflow-hidden"
            style={{
              background: "var(--surface-card)",
              borderColor: "var(--border-default)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {predictions.map((p) => (
              <li
                key={p.placeId}
                role="option"
                aria-selected={query === p.description}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectPrediction(p.description);
                }}
                className="flex items-start gap-3 px-4 py-3 cursor-pointer text-sm transition-colors"
                style={{ borderBottom: "1px solid var(--border-default)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--surface-section)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <svg
                  className="w-4 h-4 mt-0.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  style={{ color: "var(--text-subtle)" }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span style={{ color: "var(--text-body)" }}>{p.description}</span>
              </li>
            ))}
            <li
              className="px-4 py-2 text-xs text-right"
              style={{ color: "var(--text-subtle)", background: "var(--surface-section)" }}
            >
              Powered by Google
            </li>
          </ul>
        )}

        {/* No-API fallback hint */}
        {!apiKey && (
          <p className="text-xs mt-1.5" style={{ color: "var(--text-subtle)" }}>
            Add <code className="text-xs bg-base-200 px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_KEY</code> to enable address suggestions.
          </p>
        )}

        {/* Validation messages */}
        {error && !comingSoon && (
          <p className="text-xs mt-1.5 text-error flex items-center gap-1">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </p>
        )}
      </div>

      {comingSoon && (
        <Alert variant="warning" className="mb-4">
          <p className="font-medium">{comingSoon} isn&apos;t covered yet</p>
          <p className="mt-0.5 text-xs">
            We&apos;re launching there soon — we&apos;ll send you an SMS the moment we go live.
          </p>
        </Alert>
      )}

      {addressOk && (
        <Alert variant="success" className="mb-4">
          <span className="font-medium">We cover this area!</span> Your keeper will come to you.
        </Alert>
      )}

      {/* Zone grid */}
      <div
        className="rounded-xl p-4 text-sm"
        style={{ background: "var(--surface-section)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-subtle)" }}>
          Where we operate
        </p>
        <div className="grid grid-cols-2 gap-y-2">
          {[
            { name: "Lekki", active: true },
            { name: "Ajah", active: true },
            { name: "Victoria Island", active: false },
            { name: "Ikeja", active: false },
            { name: "Surulere", active: false },
          ].map(({ name, active }) => (
            <div key={name} className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: active ? "var(--klova-success)" : "var(--border-strong)" }}
              />
              <span className="text-xs" style={{ color: active ? "var(--text-body)" : "var(--text-subtle)" }}>
                {name}{!active && <span className="ml-1 opacity-60">· soon</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <Button variant="ghost" onClick={onBack} className="flex-1">Back</Button>
        <Button variant="primary" onClick={handleNext} className="flex-1">Continue</Button>
      </div>
    </div>
  );
}
