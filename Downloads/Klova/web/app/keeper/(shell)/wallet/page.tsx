"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

type WalletSummary = {
  owed_earnings_kobo: number;
  owed_transport_kobo: number;
  withdrawn_or_pending_kobo: number;
  available_kobo: number;
  total_earned_kobo: number;
};

function ngn(kobo: number) {
  return "₦" + Math.round(kobo / 100).toLocaleString("en-NG");
}

export default function KeeperWalletPage() {
  const [w, setW]             = useState<WalletSummary | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/keeper/wallet")
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error ?? "Failed to load wallet");
        setW(d);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const hasWithdrawals = (w?.withdrawn_or_pending_kobo ?? 0) > 0;

  return (
    <div className="px-4 pt-6 pb-4">
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
                {ngn(w?.available_kobo ?? 0)}
              </p>
            )}
          </Card>

          {/* Breakdown */}
          <Card shadow="sm" className="p-4 mt-4 space-y-3">
            <Row label="Cleaning earnings owed" loading={loading} value={w && ngn(w.owed_earnings_kobo)} />
            <Row label="Transport owed" loading={loading} value={w && ngn(w.owed_transport_kobo)} />
            {(loading || hasWithdrawals) && (
              <Row
                label="Withdrawn or pending"
                loading={loading}
                value={w && `− ${ngn(w.withdrawn_or_pending_kobo)}`}
                muted
              />
            )}
            <div className="border-t pt-3 flex items-center justify-between gap-4" style={{ borderColor: "var(--border-default)" }}>
              <span className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>Available</span>
              {loading ? (
                <Skeleton className="h-5 w-20 rounded" />
              ) : (
                <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text-strong)" }}>
                  {ngn(w?.available_kobo ?? 0)}
                </span>
              )}
            </div>
          </Card>

          {/* Lifetime */}
          <Card shadow="sm" className="p-4 mt-3">
            <Row label="Total earned all-time" loading={loading} value={w && ngn(w.total_earned_kobo)} strong />
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

function Row({
  label, value, loading, muted, strong,
}: {
  label: string;
  value: string | null | false | undefined;
  loading: boolean;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm" style={{ color: muted ? "var(--text-subtle)" : "var(--text-muted)" }}>{label}</span>
      {loading ? (
        <Skeleton className="h-4 w-20 rounded" />
      ) : (
        <span
          className={`text-sm tabular-nums ${strong ? "font-bold" : "font-medium"}`}
          style={{ color: muted ? "var(--text-subtle)" : "var(--text-strong)" }}
        >
          {value}
        </span>
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
