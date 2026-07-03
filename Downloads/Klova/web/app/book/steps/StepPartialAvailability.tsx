"use client";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Skeleton";
import { formatNGN } from "../data";

interface Props {
  date: string | null;
  singleKeeperTotal: number;
  alternativeDates: string[];
  submitting: boolean;
  submitError: string | null;
  onProceedWith1: () => void;
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

export default function StepPartialAvailability({
  date,
  singleKeeperTotal,
  alternativeDates,
  submitting,
  submitError,
  onProceedWith1,
  onRetryWithDate,
  onChangeDateManually,
}: Props) {
  const dateLine = date ? `on ${formatLong(date)}` : "on your chosen date";

  return (
    <div className="max-w-lg mx-auto px-4 pt-8 pb-40">
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-8">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
          style={{ background: "var(--klova-accent-soft)" }}
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            style={{ color: "var(--klova-accent)" }}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold mb-2" style={{ color: "var(--text-strong)" }}>
          Only 1 keeper free {dateLine}
        </h2>
        <p className="text-sm leading-relaxed max-w-sm" style={{ color: "var(--text-muted)" }}>
          We found 1 Klova Keeper available, not the 2 you requested. Continue with 1 at a lower price, or pick a date when 2 are free.
        </p>
      </div>

      {submitError && (
        <Alert variant="error" className="mb-5">
          <p className="text-sm">{submitError}</p>
        </Alert>
      )}

      {/* Option A — proceed with 1 keeper */}
      <div
        className="rounded-2xl border p-5 mb-4"
        style={{ borderColor: "var(--border-default)", background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}
      >
        <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
          Continue with 1 keeper
        </p>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Re-priced at {formatNGN(singleKeeperTotal)}. Your date and everything else stays the same.
        </p>
        <Button
          variant="primary"
          className="w-full flex items-center justify-center gap-2"
          disabled={submitting}
          onClick={onProceedWith1}
        >
          {submitting ? (
            <><Spinner size="sm" /><span>Finding your keeper…</span></>
          ) : (
            `Book 1 keeper: ${formatNGN(singleKeeperTotal)}`
          )}
        </Button>
      </div>

      {/* Option B — dates with 2 keepers free */}
      {alternativeDates.length > 0 && (
        <div
          className="rounded-2xl border p-5 mb-4"
          style={{ borderColor: "var(--border-default)", background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}
        >
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
            Or choose a date when 2 keepers are free
          </p>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            These dates have at least 2 Klova Keepers available in Lekki / Ajah:
          </p>
          <div className="flex flex-wrap gap-2.5">
            {alternativeDates.map((d) => (
              <button
                key={d}
                type="button"
                disabled={submitting}
                onClick={() => onRetryWithDate(d)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all duration-150 disabled:opacity-40 active:scale-95"
                style={{
                  borderColor: "var(--klova-accent)",
                  background: "var(--klova-accent-soft)",
                  color: "var(--klova-primary)",
                }}
              >
                {formatChip(d)}
              </button>
            ))}
          </div>
          {submitting && (
            <div
              className="flex items-center justify-center gap-2 mt-4 text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              <Spinner size="sm" />
              <span>Matching 2 keepers on the new date&hellip;</span>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-center mt-4">
        <Button variant="ghost" onClick={onChangeDateManually} disabled={submitting}>
          ← Pick a different date
        </Button>
      </div>
    </div>
  );
}
