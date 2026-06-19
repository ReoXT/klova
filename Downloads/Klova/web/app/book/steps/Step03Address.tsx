"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { BookingData, PriceBreakdown } from "../types";
import { formatNGN } from "../data";
import { Button } from "@/components/ui/Button";

interface Props {
  data: BookingData;
  patch: (p: Partial<BookingData>) => void;
  price: PriceBreakdown;
  onNext: () => void;
  onBack: () => void;
}

interface Suggestion {
  displayName: string;
  placeId: string;
}

async function fetchSuggestions(query: string): Promise<Suggestion[]> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    addressdetails: "0",
    limit: "6",
    countrycodes: "ng",
    "accept-language": "en",
  });
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { "User-Agent": "Klova/1.0 (klova-nine.vercel.app)" } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data as { display_name: string; place_id: number }[]).map((r) => ({
    displayName: r.display_name,
    placeId: String(r.place_id),
  }));
}

export default function Step03Address({ data, patch, price, onNext, onBack }: Props) {
  const [query, setQuery] = useState(data.address);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 4) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const results = await fetchSuggestions(q);
      setSuggestions(results);
      setOpen(results.length > 0);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInput(val: string) {
    setQuery(val);
    patch({ address: val });
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 600);
  }

  function selectSuggestion(name: string) {
    setQuery(name);
    patch({ address: name });
    setSuggestions([]);
    setOpen(false);
    setTouched(true);
    setError(null);
  }

  function handleNext() {
    setTouched(true);
    if (query.trim().length < 8) {
      setError("Please enter your full address.");
      return;
    }
    onNext();
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
        Where are we cleaning?
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Enter your full address in Lekki or Ajah — we&apos;ll confirm your area when matching your keeper.
      </p>

      {/* Autocomplete combobox */}
      <div ref={containerRef} className="relative mb-5">
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
            placeholder="e.g. 5 Chevron Drive, Lekki"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onBlur={() => setTimeout(() => setOpen(false), 180)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            className={["input w-full pr-10", error ? "input-error" : ""].filter(Boolean).join(" ")}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {loading ? (
              <span className="loading loading-spinner loading-xs" style={{ color: "var(--klova-primary)" }} />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                style={{ color: "var(--text-subtle)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </span>
        </div>

        {/* Suggestions dropdown */}
        {open && suggestions.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden border"
            style={{
              background: "var(--surface-card)",
              borderColor: "var(--border-default)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {suggestions.map((s) => (
              <li
                key={s.placeId}
                role="option"
                aria-selected={query === s.displayName}
                onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s.displayName); }}
                className="flex items-start gap-3 px-4 py-3 cursor-pointer text-sm"
                style={{ borderBottom: "1px solid var(--border-default)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLLIElement).style.background = "var(--surface-section)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLLIElement).style.background = "transparent"; }}
              >
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                  style={{ color: "var(--text-subtle)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span style={{ color: "var(--text-body)" }}>{s.displayName}</span>
              </li>
            ))}
            <li className="px-4 py-2 text-xs text-right"
              style={{ color: "var(--text-subtle)", background: "var(--surface-section)" }}>
              © OpenStreetMap contributors
            </li>
          </ul>
        )}

        {error && (
          <p className="text-xs mt-1.5 text-error flex items-center gap-1">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </p>
        )}
      </div>

      {/* Zone coverage info */}
      <div className="rounded-xl p-4" style={{ background: "var(--surface-section)" }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-subtle)" }}>
          Where we operate
        </p>
        <div className="grid grid-cols-2 gap-y-2 text-xs">
          {[
            { name: "Lekki", active: true },
            { name: "Ajah", active: true },
            { name: "Victoria Island", active: false },
            { name: "Ikeja", active: false },
            { name: "Surulere", active: false },
          ].map(({ name, active }) => (
            <div key={name} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0"
                style={{ background: active ? "var(--klova-success)" : "var(--border-strong)" }} />
              <span style={{ color: active ? "var(--text-body)" : "var(--text-subtle)" }}>
                {name}{!active && <span className="ml-1 opacity-60">· soon</span>}
              </span>
            </div>
          ))}
        </div>
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
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onBack} className="flex-1">Back</Button>
            <Button variant="primary" onClick={handleNext} className="flex-1">Continue</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
