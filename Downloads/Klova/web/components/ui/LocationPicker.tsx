"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/Skeleton";

// Lagos bounding box (generous, covers all current service zones)
const BBOX = { minLat: 6.35, maxLat: 6.75, minLng: 2.70, maxLng: 4.00 };
function inLagos(lat: number, lng: number) {
  return lat >= BBOX.minLat && lat <= BBOX.maxLat && lng >= BBOX.minLng && lng <= BBOX.maxLng;
}

const MapComponent = dynamic(() => import("./LocationPickerMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 240,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--surface-subtle)",
        borderRadius: "0.75rem",
      }}
    >
      <Spinner />
    </div>
  ),
});

interface GeoResult { label: string; lat: number; lng: number }

export interface LocationPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
  /** API route to call for geocode search. Defaults to /api/admin/geocode */
  geocodeEndpoint?: string;
  /** Whether to show the "Clear location" button. Defaults to true. */
  allowClear?: boolean;
  /** Initial text to show in the search box (set once on mount). */
  value?: string;
  /** Called on every keystroke and when a geocode result is selected. */
  onQueryChange?: (q: string) => void;
}

export function LocationPicker({
  lat, lng, onChange,
  geocodeEndpoint = "/api/admin/geocode",
  allowClear = true,
  value,
  onQueryChange,
}: LocationPickerProps) {
  const [query, setQuery]       = useState(value ?? "");
  const [results, setResults]   = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen]         = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const outOfBounds = lat != null && lng != null && !inLagos(lat, lng);

  function doSearch(q: string) {
    setQuery(q);
    onQueryChange?.(q);
    clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setResults([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setGeoError(null);
      try {
        const r = await fetch(`${geocodeEndpoint}?q=${encodeURIComponent(q)}`);
        const d = await r.json() as { results?: GeoResult[]; error?: string };
        if (r.status === 503) {
          setGeoError(d.error ?? "Geocoding not configured");
          return;
        }
        const list = d.results ?? [];
        setResults(list);
        setOpen(list.length > 0);
      } catch {
        setGeoError("Couldn't reach geocoding service");
      } finally {
        setSearching(false);
      }
    }, 400);
  }

  function select(r: GeoResult) {
    setQuery(r.label);
    onQueryChange?.(r.label);
    setResults([]);
    setOpen(false);
    onChange(r.lat, r.lng);
  }

  function clear() {
    setQuery("");
    onQueryChange?.("");
    setResults([]);
    setOpen(false);
    onChange(null, null);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {/* Geocode search */}
      <div ref={dropdownRef} className="relative">
        <input
          className="input input-bordered w-full text-sm pr-8"
          placeholder="Search address or area…"
          value={query}
          onChange={(e) => doSearch(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        {searching ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner size="xs" />
          </span>
        ) : query ? (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-base leading-none"
            style={{ color: "var(--text-muted)" }}
            onClick={clear}
            aria-label="Clear"
          >
            ✕
          </button>
        ) : null}

        {open && results.length > 0 && (
          <ul
            className="absolute z-50 w-full rounded-xl overflow-hidden shadow-lg text-sm mt-1"
            style={{ background: "var(--surface-card)", border: "1px solid var(--border-default)" }}
          >
            {results.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-base-200 transition-colors truncate"
                  onMouseDown={(e) => { e.preventDefault(); select(r); }}
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {geoError && <p className="text-xs text-error">{geoError}</p>}

      {/* Coordinate readout */}
      {lat != null && lng != null ? (
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </p>
      ) : (
        <p className="text-xs" style={{ color: "var(--text-subtle)" }}>
          Search above or click the map to place a pin
        </p>
      )}

      {outOfBounds && (
        <div className="alert alert-soft alert-warning text-xs py-2">
          ⚠ These coordinates fall outside Greater Lagos — double-check the pin.
        </div>
      )}

      {/* Map */}
      <MapComponent lat={lat} lng={lng} onChange={(newLat, newLng) => onChange(newLat, newLng)} />

      {allowClear && lat != null && lng != null && (
        <button
          type="button"
          className="btn btn-ghost btn-xs self-start text-error"
          onClick={clear}
        >
          Clear location
        </button>
      )}
    </div>
  );
}
