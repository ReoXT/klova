"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";

/* ── Types ─────────────────────────────────────────────────────── */

type Job = {
  booking_id: string;
  booking_date: string;
  time_slot: string | null;
  address: string;
  bedrooms: string;
  service_name: string;
};

type DashboardData = {
  next_job: Job | null;
  today_jobs: Job[];
  wallet: { available_kobo: number };
};

type Cleaner = { id: string; first_name: string; last_name: string; status: string };

/* ── Helpers ───────────────────────────────────────────────────── */

function ngn(kobo: number) {
  return "₦" + Math.round(kobo / 100).toLocaleString("en-NG");
}

function lagosTodayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

function friendlyDate(dateStr: string) {
  const today = lagosTodayISO();
  const t = new Date(today + "T00:00:00");
  const d = new Date(dateStr + "T00:00:00");
  const diffDays = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", hour12: false }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/* ── Page ──────────────────────────────────────────────────────── */

export default function KeeperDashboardPage() {
  const [cleaner, setCleaner]     = useState<Cleaner | null>(null);
  const [data, setData]           = useState<DashboardData | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/keeper/me").then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
      fetch("/api/keeper/dashboard").then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
    ])
      .then(([me, dash]) => {
        if (!me.ok) throw new Error(me.d.error ?? "Failed to load profile");
        if (!dash.ok) throw new Error(dash.d.error ?? "Failed to load dashboard");
        setCleaner(me.d.cleaner);
        setData(dash.d);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const todayDisplay = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos", weekday: "long", day: "numeric", month: "long",
  }).format(new Date());

  return (
    <div>
      {/* ── Greeting ──────────────────────────────────────────────── */}
      <div className="px-4 pt-6">
        <p className="wordmark text-sm tracking-wide" style={{ color: "var(--klova-primary)" }}>
          Klova <span className="font-normal" style={{ color: "var(--text-subtle)" }}>Keeper</span>
        </p>

        {loading ? (
          <Skeleton className="h-8 w-2/3 mt-3 rounded" />
        ) : (
          <h1 className="text-3xl mt-2" style={{ color: "var(--text-strong)" }}>
            {greeting()}{cleaner ? `, ${cleaner.first_name}` : ""}
          </h1>
        )}
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{todayDisplay}</p>
      </div>

      <div className="px-4 mt-5 space-y-4">
        {error && (
          <div
            className="rounded-2xl p-4 text-sm"
            style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)", color: "var(--color-error)" }}
          >
            {error}
          </div>
        )}

        {/* ── Hero: next job ──────────────────────────────────────── */}
        <Link href="/keeper/jobs" className="block active:scale-[0.98] transition-transform">
          <Card shadow="md">
            {loading ? (
              <div className="p-5">
                <SkeletonText lines={3} />
              </div>
            ) : data?.next_job ? (
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--klova-primary)" }}>
                  Next job
                </p>
                <p className="text-xl mt-1.5 font-semibold" style={{ color: "var(--text-strong)" }}>
                  {friendlyDate(data.next_job.booking_date)}
                  {data.next_job.time_slot ? ` · ${data.next_job.time_slot}` : ""}
                </p>
                <p className="text-sm mt-1" style={{ color: "var(--text-body)" }}>
                  {data.next_job.service_name} · {data.next_job.bedrooms} bed
                </p>
                <p className="text-sm mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                  {data.next_job.address}
                </p>
              </div>
            ) : (
              <EmptyState
                icon={<CalendarIcon />}
                heading="No upcoming jobs"
                message="New assignments will show up here as soon as they're confirmed."
                className="py-10"
              />
            )}
          </Card>
        </Link>

        {/* ── Stat row: today + wallet ────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/keeper/jobs" className="active:scale-[0.97] transition-transform">
            <Card shadow="sm" padded className="h-full p-4!">
              <div className="flex items-center gap-2" style={{ color: "var(--klova-primary)" }}>
                <JobsStatIcon className="w-5 h-5" />
                <span className="text-xs font-semibold uppercase tracking-wider">Today</span>
              </div>
              {loading ? (
                <Skeleton className="h-8 w-12 mt-2 rounded" />
              ) : (
                <p className="text-3xl font-bold mt-1.5 tabular-nums" style={{ color: "var(--text-strong)" }}>
                  {data?.today_jobs.length ?? 0}
                </p>
              )}
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                job{data?.today_jobs.length === 1 ? "" : "s"} scheduled
              </p>
            </Card>
          </Link>

          <Link href="/keeper/wallet" className="active:scale-[0.97] transition-transform">
            <Card shadow="sm" padded className="h-full p-4!">
              <div className="flex items-center gap-2" style={{ color: "var(--klova-accent-content)" }}>
                <WalletStatIcon className="w-5 h-5" style={{ color: "var(--klova-accent)" }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Wallet
                </span>
              </div>
              {loading ? (
                <Skeleton className="h-8 w-20 mt-2 rounded" />
              ) : (
                <p className="text-2xl font-bold mt-1.5 tabular-nums" style={{ color: "var(--text-strong)" }}>
                  {ngn(data?.wallet.available_kobo ?? 0)}
                </p>
              )}
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>available</p>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── Icons ─────────────────────────────────────────────────────── */

function CalendarIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  );
}

function JobsStatIcon(props: { className?: string }) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function WalletStatIcon(props: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1 0-6h3.75M21 12v3.75A2.25 2.25 0 0 1 18.75 18H5.25A2.25 2.25 0 0 1 3 15.75V6a2.25 2.25 0 0 1 2.25-2.25h9.5M21 12h-4.5a1.5 1.5 0 0 0 0 3H21" />
    </svg>
  );
}
