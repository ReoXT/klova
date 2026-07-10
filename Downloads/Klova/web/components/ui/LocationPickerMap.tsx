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
}

// Holds live Leaflet state — typed loosely because the module is loaded async
type MapState = {
  map:    LType.Map;
  marker: LType.Marker | null;
  L:      typeof LType;
};

export default function LocationPickerMap({ lat, lng, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef     = useRef<MapState | null>(null);
  const onChangeRef  = useRef(onChange);
  // Keep callback ref current without re-running effects
  useEffect(() => { onChangeRef.current = onChange; });

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
          onChangeRef.current(p.lat, p.lng);
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
        onChangeRef.current(e.latlng.lat, e.latlng.lng);
      });

      stateRef.current = state;
    });

    return () => {
      cancelled = true;
      stateRef.current?.map.remove();
      stateRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync marker when lat/lng are updated externally (geocode selection)
  useEffect(() => {
    if (lat == null || lng == null || !stateRef.current) return;
    const { map, L } = stateRef.current;
    const latlng = L.latLng(lat, lng);

    if (stateRef.current.marker) {
      stateRef.current.marker.setLatLng(latlng);
    } else {
      const icon = L.divIcon({ html: PIN_SVG, className: "", iconSize: [28, 40], iconAnchor: [14, 40] });
      const m = L.marker(latlng, { draggable: true, icon }).addTo(map);
      m.on("dragend", () => {
        const p = m.getLatLng();
        onChangeRef.current(p.lat, p.lng);
      });
      stateRef.current.marker = m;
    }
    map.setView(latlng, 14);
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      style={{ height: 240, width: "100%", borderRadius: "0.75rem", overflow: "hidden" }}
    />
  );
}
