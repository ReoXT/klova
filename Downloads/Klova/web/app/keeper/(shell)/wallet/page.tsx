"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

function ngn(kobo: number) {
  return "₦" + Math.round(kobo / 100).toLocaleString("en-NG");
}

export default function KeeperWalletPage() {
  const [kobo, setKobo]       = useState<number | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/keeper/wallet")
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error ?? "Failed to load wallet");
        setKobo(d.available_kobo);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl" style={{ color: "var(--text-strong)" }}>Wallet</h1>
      <p className="text-sm mt-0.5 mb-5" style={{ color: "var(--text-muted)" }}>
        Your earnings, all in one place
      </p>

      {error ? (
        <div className="rounded-2xl p-4 text-sm" style={{ background: "var(--surface-card)", color: "var(--color-error)" }}>
          {error}
        </div>
      ) : (
        <>
          <Card shadow="md" className="p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Available balance
            </p>
            {loading ? (
              <Skeleton className="h-10 w-40 mx-auto mt-3 rounded" />
            ) : (
              <p className="text-4xl font-bold mt-2 tabular-nums" style={{ color: "var(--text-strong)" }}>
                {ngn(kobo ?? 0)}
              </p>
            )}
          </Card>

          <div
            className="rounded-2xl p-4 mt-4 flex items-start gap-3"
            style={{ background: "var(--klova-primary-soft)" }}
          >
            <ClockIcon />
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>
                Withdrawals are coming soon
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Your balance updates automatically as jobs are completed. Cashing out from here launches shortly.
                For now, your admin can pay you out directly.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ClockIcon() {
  return (
    <svg
      className="w-5 h-5 shrink-0 mt-0.5"
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}
      style={{ color: "var(--klova-primary)" }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}
