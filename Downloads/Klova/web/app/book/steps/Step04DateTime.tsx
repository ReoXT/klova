"use client";

import { useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import type { BookingData, PriceBreakdown, TimeSlot } from "../types";
import { TIME_SLOTS, formatNGN } from "../data";
import { Button } from "@/components/ui/Button";

interface Props {
  data: BookingData;
  patch: (p: Partial<BookingData>) => void;
  price: PriceBreakdown;
  onNext: () => void;
  onBack: () => void;
}

const today = new Date();
today.setHours(0, 0, 0, 0);
const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
const threeMonthsOut = new Date(today.getFullYear(), today.getMonth() + 3, 0);

export default function Step04DateTime({ data, patch, price, onNext, onBack }: Props) {
  const [error, setError] = useState<string | null>(null);

  const selected = data.bookingDate
    ? (() => {
        const [y, m, d] = data.bookingDate.split("-").map(Number);
        return new Date(y, m - 1, d);
      })()
    : undefined;

  function handleSelect(day: Date | undefined) {
    if (!day) return;
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    patch({ bookingDate: iso, timeSlot: null });
    setError(null);
  }

  function handleNext() {
    if (!data.bookingDate) { setError("Please pick a date."); return; }
    if (!data.timeSlot)    { setError("Please pick a time slot."); return; }
    onNext();
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
        When should we come?
      </h1>
      <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
        Pick a date, earliest available is tomorrow.
      </p>

      {/* Calendar */}
      <div
        className="rounded-2xl border flex justify-center py-2 mb-5"
        style={{
          borderColor: "var(--border-default)",
          background: "var(--surface-card)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <style>{`
          .klova-cal .rdp-root {
            --rdp-accent-color: oklch(0.68 0.14 67);
            --rdp-accent-background-color: oklch(0.68 0.14 67 / 0.10);
            --rdp-today-color: oklch(0.68 0.14 67);
            --rdp-day-height: 40px;
            --rdp-day-width: 40px;
            --rdp-day_button-height: 38px;
            --rdp-day_button-width: 38px;
            --rdp-day_button-border-radius: 10px;
            font-family: var(--font-plus-jakarta), system-ui, sans-serif;
            font-size: 0.875rem;
          }
          .klova-cal .rdp-month_caption {
            font-weight: 600;
            color: var(--text-strong);
            padding-bottom: 0.5rem;
          }
          .klova-cal .rdp-weekday {
            color: var(--text-subtle);
            font-weight: 500;
            font-size: 0.75rem;
          }
          .klova-cal .rdp-day {
            color: var(--text-body);
          }
          .klova-cal .rdp-day_button:hover:not([disabled]) {
            background: var(--surface-section);
          }
          .klova-cal .rdp-selected .rdp-day_button {
            background: oklch(0.68 0.14 67);
            color: oklch(0.15 0.02 67);
            font-weight: 700;
          }
          .klova-cal .rdp-disabled {
            opacity: 0.3;
          }
          .klova-cal .rdp-nav {
            top: 0.1rem;
          }
          .klova-cal .rdp-button_previous,
          .klova-cal .rdp-button_next {
            border-radius: 0.5rem;
            color: var(--text-muted);
          }
          .klova-cal .rdp-button_previous:hover,
          .klova-cal .rdp-button_next:hover {
            background: var(--surface-section);
            color: var(--text-strong);
          }
          .klova-cal .rdp-today:not(.rdp-selected) .rdp-day_button {
            color: oklch(0.68 0.14 67);
            font-weight: 700;
            border: 2px solid oklch(0.68 0.14 67 / 0.3);
          }
        `}</style>
        <div className="klova-cal">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            disabled={[{ before: tomorrow }, { after: threeMonthsOut }]}
            startMonth={today}
            endMonth={threeMonthsOut}
          />
        </div>
      </div>

      {/* Time slots — appear after date picked */}
      {data.bookingDate && (
        <div className="mb-2">
          <p className="text-sm font-medium mb-3" style={{ color: "var(--text-body)" }}>
            Arrival window
          </p>
          <div className="flex flex-col gap-2.5">
            {TIME_SLOTS.map((slot) => {
              const sel = data.timeSlot === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => { patch({ timeSlot: slot as TimeSlot }); setError(null); }}
                  className="w-full text-left rounded-xl border-2 px-4 py-3 flex items-center gap-3 transition-all duration-150"
                  style={{
                    borderColor: sel ? "var(--klova-accent)" : "var(--border-default)",
                    background: sel ? "var(--klova-accent-soft)" : "var(--surface-card)",
                  }}
                >
                  <div
                    className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={{ borderColor: sel ? "var(--klova-accent)" : "var(--border-strong)" }}
                  >
                    {sel && <div className="w-2 h-2 rounded-full" style={{ background: "var(--klova-accent)" }} />}
                  </div>
                  <p className="font-semibold text-base" style={{ color: sel ? "var(--klova-primary)" : "var(--text-strong)" }}>
                    {slot}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-error mt-3 flex items-center gap-1">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </p>
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
