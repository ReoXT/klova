"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";

type Job = {
  booking_id: string;
  booking_date: string;
  time_slot: string | null;
  address: string;
  bedrooms: string;
  service_name: string;
};

function lagosTodayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

function friendlyDate(dateStr: string) {
  const t = new Date(lagosTodayISO() + "T00:00:00");
  const d = new Date(dateStr + "T00:00:00");
  const diffDays = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default function KeeperJobsPage() {
  const [jobs, setJobs]       = useState<Job[] | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/keeper/jobs")
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error ?? "Failed to load jobs");
        setJobs(d.jobs);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl" style={{ color: "var(--text-strong)" }}>Your jobs</h1>
      <p className="text-sm mt-0.5 mb-5" style={{ color: "var(--text-muted)" }}>
        Confirmed bookings assigned to you
      </p>

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : error ? (
        <div className="rounded-2xl p-4 text-sm" style={{ background: "var(--surface-card)", color: "var(--color-error)" }}>
          {error}
        </div>
      ) : jobs && jobs.length > 0 ? (
        <div className="space-y-3">
          {jobs.map((j) => (
            <Card key={j.booking_id} shadow="sm" className="overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold" style={{ color: "var(--text-strong)" }}>
                    {friendlyDate(j.booking_date)}
                    {j.time_slot ? ` · ${j.time_slot}` : ""}
                  </p>
                  <span
                    className="badge badge-sm badge-soft shrink-0"
                    style={{ background: "var(--klova-primary-soft)", color: "var(--klova-primary)" }}
                  >
                    Confirmed
                  </span>
                </div>
                <p className="text-sm mt-1" style={{ color: "var(--text-body)" }}>
                  {j.service_name} · {j.bedrooms} bed
                </p>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{j.address}</p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<JobsIcon />}
          heading="No jobs yet"
          message="Once you're assigned and a customer pays, your confirmed jobs will show up here."
        />
      )}
    </div>
  );
}

function JobsIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}
