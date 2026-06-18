"use client";

import { useEffect, useState } from "react";
import type { BookingData } from "../types";
import { FAKE_KEEPER } from "../data";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Skeleton";

interface Props {
  data: BookingData;
  onNext: () => void;
}

const MATCH_DELAY_MS = 3200;
const TIMER_SECONDS = 25 * 60; // 25 minutes

export default function Step11Matching({ data, onNext }: Props) {
  const [matched, setMatched] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS);

  useEffect(() => {
    const t = setTimeout(() => setMatched(true), MATCH_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!matched) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 0) { clearInterval(interval); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [matched]);

  const mins = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const secs = (secondsLeft % 60).toString().padStart(2, "0");
  const expired = secondsLeft === 0;

  if (!matched) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-16 pb-4 flex flex-col items-center text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: "var(--klova-primary-soft)" }}
        >
          <Spinner size="lg" />
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-strong)" }}>
          Finding your keeper…
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          We&apos;re matching you with the best available keeper in Lekki / Ajah right now.
        </p>

        <div className="mt-8 space-y-3 w-full text-left max-w-xs">
          {["Checking keeper availability", "Reviewing ratings and proximity", "Reserving your slot"].map(
            (step, i) => (
              <div key={step} className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                  style={{
                    background: i === 0 ? "var(--klova-primary)" : "var(--border-default)",
                    color: i === 0 ? "white" : "var(--text-subtle)",
                  }}
                >
                  {i + 1}
                </div>
                <p className="text-sm" style={{ color: i === 0 ? "var(--text-body)" : "var(--text-subtle)" }}>
                  {step}
                </p>
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-10 pb-4">
      {/* Success badge */}
      <div className="flex flex-col items-center text-center mb-8">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
          style={{ background: "var(--klova-success-soft)" }}
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            style={{ color: "var(--klova-success)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
          You&apos;re matched!
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Your slot is reserved. Complete payment within:
        </p>
        <p
          className={`text-4xl font-bold mt-2 tabular-nums ${expired ? "text-error" : ""}`}
          style={{ color: expired ? undefined : "var(--klova-accent)", letterSpacing: "0.05em" }}
        >
          {mins}:{secs}
        </p>
        {expired && (
          <p className="text-xs text-error mt-1">Time expired — your slot may have been released.</p>
        )}
      </div>

      {/* Keeper card */}
      <div
        className="rounded-2xl border p-5 mb-6"
        style={{ borderColor: "var(--border-default)", background: "var(--surface-card)", boxShadow: "var(--shadow-md)" }}
      >
        <p className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: "var(--text-subtle)" }}>
          Your keeper
        </p>
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shrink-0"
            style={{ background: "var(--klova-primary-soft)", color: "var(--klova-primary)" }}
          >
            {FAKE_KEEPER.firstName[0]}{FAKE_KEEPER.lastName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-base" style={{ color: "var(--text-strong)" }}>
                {FAKE_KEEPER.firstName} {FAKE_KEEPER.lastName}
              </p>
              {FAKE_KEEPER.ninVerified && (
                <span
                  className="badge badge-xs"
                  style={{
                    background: "var(--klova-success-soft)",
                    color: "var(--klova-success)",
                    border: "none",
                    fontSize: "0.65rem",
                  }}
                >
                  NIN Verified
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"
                style={{ color: "var(--klova-accent)" }}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="text-sm font-semibold" style={{ color: "var(--klova-accent)" }}>
                {FAKE_KEEPER.rating}
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                · {FAKE_KEEPER.totalJobs} jobs completed
              </span>
            </div>
          </div>
        </div>

        <p className="text-xs mt-4 pt-4 border-t" style={{ color: "var(--text-muted)", borderColor: "var(--border-default)" }}>
          {FAKE_KEEPER.firstName} has been with Klova since 2024 and maintains an exceptional track record. Your details will be shared with her once payment is confirmed.
        </p>
      </div>

      <Button
        variant="primary"
        className="w-full"
        disabled={expired}
        onClick={onNext}
      >
        Pay now — secure my booking
      </Button>

      <p className="text-xs text-center mt-3" style={{ color: "var(--text-subtle)" }}>
        You won&apos;t be charged until payment is confirmed via Paystack.
      </p>
    </div>
  );
}
