"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Skeleton";
import type { BookingData } from "../types";

interface Props {
  data: BookingData;
  alternatives: string[];
  submitting: boolean;
  submitError: string | null;
  onRetryWithDate: (date: string) => void;
  onChangeDateManually: () => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function localDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatChip(iso: string) {
  const dt = localDate(iso);
  return `${WEEKDAYS[dt.getDay()]} · ${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]}`;
}

function formatLong(iso: string) {
  const dt = localDate(iso);
  return `${dt.getDate()} ${MONTHS_LONG[dt.getMonth()]}`;
}

const CalendarXIcon = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4} aria-hidden>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 13.5l4.5 4.5m0-4.5l-4.5 4.5" />
  </svg>
);

export default function StepNoMatch({
  data,
  alternatives,
  submitting,
  submitError,
  onRetryWithDate,
  onChangeDateManually,
}: Props) {
  const dateLine = data.bookingDate
    ? `on ${formatLong(data.bookingDate)}`
    : "on your chosen date";

  return (
    <div className="max-w-lg mx-auto px-4 pt-8 pb-40">
      <EmptyState
        icon={CalendarXIcon}
        heading="No keepers available"
        message={`We don't have any Klova Keepers free ${dateLine} in Lekki / Ajah.`}
      />

      {submitError && (
        <Alert variant="error" className="mb-5 mt-2">
          <p className="text-sm">{submitError}</p>
        </Alert>
      )}

      {alternatives.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm text-center font-medium mb-5" style={{ color: "var(--text-body)" }}>
            Tap a date below. Your other details stay exactly as you entered them:
          </p>

          <div className="flex flex-wrap gap-2.5 justify-center">
            {alternatives.map((date) => (
              <button
                key={date}
                type="button"
                disabled={submitting}
                onClick={() => onRetryWithDate(date)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all duration-150 disabled:opacity-40 active:scale-95"
                style={{
                  borderColor: "var(--klova-accent)",
                  background: "var(--klova-accent-soft)",
                  color: "var(--klova-primary)",
                }}
              >
                {formatChip(date)}
              </button>
            ))}
          </div>

          {submitting && (
            <div
              className="flex items-center justify-center gap-2 mt-6 text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              <Spinner size="sm" />
              <span>Matching you on the new date&hellip;</span>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 text-center">
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Unfortunately there are no available slots in the next 14 days either.
            <br />
            Please go back and try a different date, or check back soon.
          </p>
        </div>
      )}

      <div className="flex justify-center mt-8">
        <Button
          variant="ghost"
          onClick={onChangeDateManually}
          disabled={submitting}
        >
          ← Pick a different date
        </Button>
      </div>
    </div>
  );
}
