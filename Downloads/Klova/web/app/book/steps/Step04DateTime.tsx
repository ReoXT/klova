"use client";

import { useState } from "react";
import type { BookingData, TimeSlot } from "../types";
import { TIME_SLOTS } from "../data";
import { Button } from "@/components/ui/Button";

interface Props {
  data: BookingData;
  patch: (p: Partial<BookingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseYMD(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export default function Step04DateTime({ data, patch, onNext, onBack }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = new Date(today.getTime() + 24 * 60 * 60 * 1000); // tomorrow

  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [error, setError] = useState<string | null>(null);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const maxDate = new Date(today.getFullYear(), today.getMonth() + 3, 0);

  function handleDate(d: number) {
    const date = new Date(year, month, d);
    if (date < minDate || date > maxDate) return;
    patch({ bookingDate: toYMD(date), timeSlot: null });
    setError(null);
  }

  function handleNext() {
    if (!data.bookingDate) { setError("Please pick a date."); return; }
    if (!data.timeSlot) { setError("Please pick a time slot."); return; }
    setError(null);
    onNext();
  }

  const selectedDate = data.bookingDate ? parseYMD(data.bookingDate) : null;

  const prevDisabled = viewMonth <= new Date(today.getFullYear(), today.getMonth(), 1);
  const nextDisabled = viewMonth >= new Date(today.getFullYear(), today.getMonth() + 3, 1);

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
        When should we come?
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Choose a date at least 24 hours from now.
      </p>

      {/* Calendar */}
      <div
        className="rounded-2xl border p-4 mb-4"
        style={{ borderColor: "var(--border-default)", background: "var(--surface-card)" }}
      >
        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => setViewMonth(addMonths(viewMonth, -1))}
            disabled={prevDisabled}
            className="btn btn-ghost btn-sm btn-square"
            aria-label="Previous month"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <p className="font-semibold text-sm" style={{ color: "var(--text-strong)" }}>
            {viewMonth.toLocaleDateString("en-NG", { month: "long", year: "numeric" })}
          </p>
          <button
            type="button"
            onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            disabled={nextDisabled}
            className="btn btn-ghost btn-sm btn-square"
            aria-label="Next month"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-xs font-medium py-1" style={{ color: "var(--text-subtle)" }}>
              {d}
            </div>
          ))}
        </div>

        {/* Date grid */}
        <div className="grid grid-cols-7 gap-y-1">
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const date = new Date(year, month, dayNum);
            const isDisabled = date < minDate || date > maxDate;
            const isSelected = selectedDate
              ? date.getFullYear() === selectedDate.getFullYear() &&
                date.getMonth() === selectedDate.getMonth() &&
                date.getDate() === selectedDate.getDate()
              : false;
            const isToday =
              date.getDate() === today.getDate() &&
              date.getMonth() === today.getMonth() &&
              date.getFullYear() === today.getFullYear();

            return (
              <button
                key={dayNum}
                type="button"
                disabled={isDisabled}
                onClick={() => handleDate(dayNum)}
                className="flex items-center justify-center h-9 rounded-lg text-sm font-medium transition-all duration-100"
                style={
                  isSelected
                    ? { background: "var(--klova-primary)", color: "var(--klova-primary-content)" }
                    : isToday
                    ? { color: "var(--klova-accent)", fontWeight: 700 }
                    : isDisabled
                    ? { color: "var(--text-subtle)", cursor: "not-allowed" }
                    : { color: "var(--text-body)" }
                }
              >
                {dayNum}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time slots — appear after date selection */}
      {data.bookingDate && (
        <div>
          <p className="text-sm font-medium mb-3" style={{ color: "var(--text-body)" }}>
            Preferred arrival window
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {TIME_SLOTS.map((slot) => {
              const sel = data.timeSlot === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => { patch({ timeSlot: slot as TimeSlot }); setError(null); }}
                  className="rounded-xl border-2 py-3 px-3 text-sm font-medium text-center transition-all duration-150"
                  style={{
                    borderColor: sel ? "var(--klova-primary)" : "var(--border-default)",
                    background: sel ? "var(--klova-primary-soft)" : "var(--surface-card)",
                    color: sel ? "var(--klova-primary)" : "var(--text-body)",
                  }}
                >
                  {slot}
                </button>
              );
            })}
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--text-subtle)" }}>
            Your keeper will arrive within the selected window.
          </p>
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

      <div className="flex gap-3 mt-6">
        <Button variant="ghost" onClick={onBack} className="flex-1">Back</Button>
        <Button variant="primary" onClick={handleNext} className="flex-1">Continue</Button>
      </div>
    </div>
  );
}
