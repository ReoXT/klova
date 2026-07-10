"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type * as LType from "leaflet";

const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 40" width="28" height="40"><path d="M14 0C6.27 0 0 6.27 0 14c0 8.75 14 26 14 26S28 22.75 28 14C28 6.27 21.73 0 14 0z" fill="#4F46E5" stroke="white" stroke-width="1.5"/><circle cx="14" cy="14" r="5.5" fill="white"/></svg>`;
const LAGOS: [number, number] = [6.5244, 3.3792];

interface Props {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  /** Fires only when the customer manually taps or drags the pin — not on geocode placement. */
  onUserInteract?: () => void;
}

// Holds live Leaflet state — typed loosely because the module is loaded async
type MapState = {
  map:    LType.Map;
  marker: LType.Marker | null;
  L:      typeof LType;
};

export default function LocationPickerMap({ lat, lng, onChange, onUserInteract }: Props) {
  const containerRef      = useRef<HTMLDivElement>(null);
  const stateRef          = useRef<MapState | null>(null);
  const onChangeRef       = useRef(onChange);
  const onUserInteractRef = useRef(onUserInteract);
  // True when the coming lat/lng update was caused by the user dragging or
  // tapping — tells the sync effect not to reset the zoom level.
  const userMovedPinRef   = useRef(false);
  // Keep callback refs current without re-running effects
  useEffect(() => { onChangeRef.current = onChange; });
  useEffect(() => { onUserInteractRef.current = onUserInteract; });

  // Initialize map once on mount
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || stateRef.current) return;

      // Read latest coords at init time
      const initLat = lat;
      const initLng = lng;
      const center: [number, number] =
        initLat != null && initLng != null ? [initLat, initLng] : LAGOS;

      const map = L.map(containerRef.current).setView(center, initLat != null ? 14 : 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const makeIcon = () =>
        L.divIcon({ html: PIN_SVG, className: "", iconSize: [28, 40], iconAnchor: [14, 40] });

      const attachDrag = (m: LType.Marker) => {
        m.on("dragend", () => {
          const p = m.getLatLng();
          userMovedPinRef.current = true;
          onChangeRef.current(p.lat, p.lng);
          onUserInteractRef.current?.();
        });
      };

      const state: MapState = {
        map,
        L,
        marker:
          initLat != null && initLng != null
            ? (() => {
                const m = L.marker([initLat, initLng], { draggable: true, icon: makeIcon() }).addTo(map);
                attachDrag(m);
                return m;
              })()
            : null,
      };

      map.on("click", (e: LType.LeafletMouseEvent) => {
        if (state.marker) {
          state.marker.setLatLng(e.latlng);
        } else {
          state.marker = L.marker(e.latlng, { draggable: true, icon: makeIcon() }).addTo(map);
          attachDrag(state.marker);
        }
        userMovedPinRef.current = true;
        onChangeRef.current(e.latlng.lat, e.latlng.lng);
        onUserInteractRef.current?.();
      });

      stateRef.current = state;
    });

    return () => {
      cancelled = true;
      stateRef.current?.map.remove();
      stateRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync marker when lat/lng change (geocode selection OR user drag/tap).
  // Only re-center + zoom when the update came from a geocode selection;
  // skip setView for user-driven moves so the zoom level they set is kept.
  useEffect(() => {
    if (lat == null || lng == null || !stateRef.current) return;
    const { map, L } = stateRef.current;
    const latlng = L.latLng(lat, lng);
    const wasUserMove = userMovedPinRef.current;
    userMovedPinRef.current = false; // consume the flag

    if (stateRef.current.marker) {
      stateRef.current.marker.setLatLng(latlng);
    } else {
      const icon = L.divIcon({ html: PIN_SVG, className: "", iconSize: [28, 40], iconAnchor: [14, 40] });
      const m = L.marker(latlng, { draggable: true, icon }).addTo(map);
      m.on("dragend", () => {
        const p = m.getLatLng();
        userMovedPinRef.current = true;
        onChangeRef.current(p.lat, p.lng);
        onUserInteractRef.current?.();
      });
      stateRef.current.marker = m;
    }

    // Geocode selections: pan + zoom to the result so the customer can see it.
    // User drag/tap: they already chose the zoom — leave it alone.
    if (!wasUserMove) {
      map.setView(latlng, 16);
    }
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      style={{ height: 240, width: "100%", borderRadius: "0.75rem", overflow: "hidden" }}
    />
  );
}
