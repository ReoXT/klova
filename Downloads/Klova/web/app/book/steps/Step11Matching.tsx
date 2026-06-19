"use client";

import { useEffect, useState } from "react";
import type { ApiCleaner } from "../types";
import { formatNGN } from "../data";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Skeleton";

interface Props {
  cleaner: ApiCleaner | null;
  serverTotal: number | null;
  payStatus: "idle" | "paying" | "redirecting";
  payError: string | null;
  onPay: () => void;
}

const TIMER_SECONDS = 25 * 60; // 25 minutes to complete payment

export default function Step11Matching({ cleaner, serverTotal, payStatus, payError, onPay }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 0) { clearInterval(interval); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const secs = (secondsLeft % 60).toString().padStart(2, "0");
  const expired = secondsLeft === 0;
  const paying = payStatus === "paying" || payStatus === "redirecting";

  const initials = cleaner
    ? `${cleaner.first_name[0]}${cleaner.last_name[0]}`
    : "?";

  return (
    <div className="max-w-lg mx-auto px-4 pt-10 pb-4">
      {/* Matched header */}
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
          className="text-4xl font-bold mt-2 tabular-nums"
          style={{
            color: expired ? "var(--color-error, oklch(0.55 0.22 25))" : "var(--klova-accent)",
            letterSpacing: "0.05em",
          }}
        >
          {mins}:{secs}
        </p>
        {expired && (
          <p className="text-xs text-error mt-1">Time expired — your slot may have been released.</p>
        )}
      </div>

      {/* Keeper card */}
      <div
        className="rounded-2xl border p-5 mb-4"
        style={{ borderColor: "var(--border-default)", background: "var(--surface-card)", boxShadow: "var(--shadow-md)" }}
      >
        <p className="text-xs font-medium mb-3 uppercase tracking-wider" style={{ color: "var(--text-subtle)" }}>
          Your keeper
        </p>
        <div className="flex items-center gap-4">
          {/* Avatar — photo or initials */}
          {cleaner?.photo_url ? (
            <img
              src={cleaner.photo_url}
              alt={`${cleaner.first_name} ${cleaner.last_name}`}
              className="w-16 h-16 rounded-full object-cover shrink-0"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shrink-0"
              style={{ background: "var(--klova-primary-soft)", color: "var(--klova-primary)" }}
            >
              {initials}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-base" style={{ color: "var(--text-strong)" }}>
                {cleaner ? `${cleaner.first_name} ${cleaner.last_name}` : "Your keeper"}
              </p>
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
            </div>
            {cleaner && (
              <div className="flex items-center gap-1 mt-1">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"
                  style={{ color: "var(--klova-accent)" }}>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <span className="text-sm font-semibold" style={{ color: "var(--klova-accent)" }}>
                  {cleaner.rating.toFixed(1)}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  · {cleaner.total_jobs} jobs completed
                </span>
              </div>
            )}
          </div>
        </div>

        {serverTotal !== null && (
          <div
            className="flex items-center justify-between mt-4 pt-4"
            style={{ borderTop: "1px solid var(--border-default)" }}
          >
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>Amount due</span>
            <span className="text-lg font-bold" style={{ color: "var(--klova-accent)" }}>
              {formatNGN(serverTotal)}
            </span>
          </div>
        )}

        <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
          {cleaner ? cleaner.first_name : "Your keeper"} is NIN-verified and highly rated.
          Your full details will be shared once payment is confirmed.
        </p>
      </div>

      {payError && (
        <Alert variant="error" className="mb-4">
          <p className="text-sm">{payError}</p>
        </Alert>
      )}

      <Button
        variant="primary"
        className="w-full flex items-center justify-center gap-2"
        disabled={expired || paying}
        onClick={onPay}
      >
        {paying ? (
          <><Spinner size="sm" /><span>{payStatus === "redirecting" ? "Redirecting to Paystack…" : "Starting payment…"}</span></>
        ) : (
          "Make Payment Now"
        )}
      </Button>

      <p className="text-xs text-center mt-3" style={{ color: "var(--text-subtle)" }}>
        You won&apos;t be charged until payment is confirmed by Paystack.
      </p>
    </div>
  );
}
