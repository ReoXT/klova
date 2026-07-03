"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";

type Job = {
  booking_id: string;
  status: string;
  booking_date: string;
  time_slot: string | null;
  service_name: string;
  bedrooms: string;
  area: string;
  earning_kobo: number;
  transport_fare_kobo: number | null;
  shared_with: string | null;
  role: "lead" | "second";
};

type JobsResponse = { upcoming: Job[]; today: Job[]; past: Job[] };

const STATUS_META: Record<string, { label: string; badge: string }> = {
  matched:   { label: "Matched",   badge: "badge-warning" },
  paid:      { label: "Paid",      badge: "badge-warning" },
  confirmed: { label: "Confirmed", badge: "badge-success" },
  completed: { label: "Completed", badge: "badge-neutral" },
  cancelled: { label: "Cancelled", badge: "badge-error" },
};

function ngn(kobo: number) {
  return "₦" + Math.round(kobo / 100).toLocaleString("en-NG");
}

function lagosTodayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

function friendlyDate(dateStr: string) {
  const t = new Date(lagosTodayISO() + "T00:00:00");
  const d = new Date(dateStr + "T00:00:00");
  const diffDays = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function JobCard({ job }: { job: Job }) {
  const meta = STATUS_META[job.status] ?? { label: job.status, badge: "badge-neutral" };
  return (
    <Link href={`/keeper/jobs/${job.booking_id}`} className="block active:scale-[0.98] transition-transform">
      <Card shadow="sm">
        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold" style={{ color: "var(--text-strong)" }}>
              {friendlyDate(job.booking_date)}
              {job.time_slot ? ` · ${job.time_slot}` : ""}
            </p>
            <span className={`badge badge-sm badge-soft shrink-0 ${meta.badge}`}>
              {meta.label}
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--text-body)" }}>
            {job.service_name} · {job.bedrooms} bed
          </p>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{job.area}</p>

          {job.shared_with && (
            <p className="text-xs mt-1" style={{ color: "var(--text-subtle)" }}>
              Shared with {job.shared_with}
            </p>
          )}

          <div className="flex items-center gap-4 mt-3 pt-3 border-t" style={{ borderColor: "var(--border-default)" }}>
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>You earn</p>
              <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-strong)" }}>
                {ngn(job.earning_kobo)}
              </p>
            </div>
            {job.transport_fare_kobo != null && job.transport_fare_kobo > 0 && (
              <div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Transport</p>
                <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-strong)" }}>
                  {ngn(job.transport_fare_kobo)}
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function Section({ title, jobs }: { title: string; jobs: Job[] }) {
  if (jobs.length === 0) return null;
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wider mb-2.5" style={{ color: "var(--text-muted)" }}>
        {title}
      </h2>
      <div className="space-y-3">
        {jobs.map((j) => <JobCard key={j.booking_id} job={j} />)}
      </div>
    </div>
  );
}

export default function KeeperJobsPage() {
  const [data, setData]       = useState<JobsResponse | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/keeper/jobs")
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error ?? "Failed to load jobs");
        setData(d);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const total = (data?.upcoming.length ?? 0) + (data?.today.length ?? 0) + (data?.past.length ?? 0);

  return (
    <div className="px-4 pt-6 pb-4">
      <h1 className="text-2xl" style={{ color: "var(--text-strong)" }}>Your jobs</h1>
      <p className="text-sm mt-0.5 mb-5" style={{ color: "var(--text-muted)" }}>
        Everything assigned to you
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
      ) : total === 0 ? (
        <EmptyState
          icon={<JobsIcon />}
          heading="No jobs yet"
          message="Once you're assigned and a customer pays, your jobs will show up here."
        />
      ) : (
        <div className="space-y-6">
          <Section title="Today" jobs={data!.today} />
          <Section title="Upcoming" jobs={data!.upcoming} />
          <Section title="Past" jobs={data!.past} />
        </div>
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
