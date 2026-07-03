"use client";

import { useEffect, useState } from "react";
import type { ApiCleaner } from "../types";
import { formatNGN } from "../data";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Skeleton";
import { KeeperCard } from "@/components/ui/KeeperCard";

interface Props {
  cleaners: ApiCleaner[];
  serverTotal: number | null;
  payStatus: "idle" | "paying" | "redirecting";
  payError: string | null;
  onPay: () => void;
}

const TIMER_SECONDS = 25 * 60;

export default function Step11Matching({ cleaners, serverTotal, payStatus, payError, onPay }: Props) {
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
  const twoKeepers = cleaners.length === 2;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-10 pb-4">
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
          {twoKeepers
            ? "The two keepers we've matched to your home"
            : "Your keeper is ready. Complete payment to confirm."}
        </p>
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          Your slot is reserved. Complete payment within:
        </p>
        <p
          className="text-4xl font-bold mt-1 tabular-nums"
          style={{
            color: expired ? "var(--color-error, oklch(0.55 0.22 25))" : "var(--klova-accent)",
            letterSpacing: "0.05em",
          }}
        >
          {mins}:{secs}
        </p>
        {expired && (
          <p className="text-xs text-error mt-1">Time expired. Your slot may have been released.</p>
        )}
      </div>

      {/* Keeper cards — side by side on desktop for 2, centred single for 1 */}
      <div className={twoKeepers ? "grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6" : "max-w-sm mx-auto mb-6"}>
        {cleaners.map((c) => (
          <KeeperCard
            key={c.id}
            firstName={c.first_name}
            photoUrl={c.photo_url}
            rating={c.rating}
            totalJobs={c.total_jobs}
          />
        ))}
      </div>

      {/* Amount due */}
      {serverTotal !== null && (
        <div
          className="flex items-center justify-between px-5 py-4 rounded-xl mb-4"
          style={{
            background: "var(--surface-card)",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>Amount due</span>
          <span className="text-lg font-bold" style={{ color: "var(--klova-accent)" }}>
            {formatNGN(serverTotal)}
          </span>
        </div>
      )}

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
