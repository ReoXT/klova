"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Skeleton";

type JobDetail = {
  booking_id: string;
  status: string;
  booking_date: string;
  time_slot: string | null;
  service_name: string;
  bedrooms: string;
  area: string;
  zone_name: string;
  full_address: string | null;
  address_available: boolean;
  earning_kobo: number;
  transport_fare_kobo: number | null;
  shared_with: string | null;
  role: "lead" | "second";
  cancellation_reason: string | null;
};

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

function fullDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

export default function KeeperJobDetailPage() {
  const params = useParams<{ id: string }>();
  const [job, setJob]         = useState<JobDetail | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/keeper/jobs/${params.id}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error ?? "Failed to load job");
        setJob(d);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <div className="px-4 pt-6 pb-4">
      <Link href="/keeper/jobs" className="text-sm inline-flex items-center gap-1 mb-4" style={{ color: "var(--klova-primary)" }}>
        <BackIcon /> Your jobs
      </Link>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : error || !job ? (
        <div className="rounded-2xl p-4 text-sm" style={{ background: "var(--surface-card)", color: "var(--color-error)" }}>
          {error ?? "Job not found"}
        </div>
      ) : (
        <JobDetailBody job={job} />
      )}
    </div>
  );
}

function JobDetailBody({ job }: { job: JobDetail }) {
  const meta = STATUS_META[job.status] ?? { label: job.status, badge: "badge-neutral" };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl" style={{ color: "var(--text-strong)" }}>{fullDate(job.booking_date)}</h1>
          {job.time_slot && (
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{job.time_slot}</p>
          )}
        </div>
        <span className={`badge badge-sm badge-soft shrink-0 ${meta.badge}`}>{meta.label}</span>
      </div>

      {job.status === "cancelled" && job.cancellation_reason && (
        <Card shadow="sm" className="p-4">
          <p className="text-sm font-semibold" style={{ color: "var(--color-error)" }}>Cancelled</p>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{job.cancellation_reason}</p>
        </Card>
      )}

      <Card shadow="sm" className="p-4 space-y-3">
        <DetailRow label="Service" value={`${job.service_name} · ${job.bedrooms} bed`} />
        <DetailRow
          label="Location"
          value={job.address_available ? job.full_address! : job.area}
        />
        {!job.address_available && (
          <p className="text-xs -mt-2" style={{ color: "var(--text-subtle)" }}>
            Full address available once the booking is confirmed
          </p>
        )}
        {job.shared_with && (
          <DetailRow label="Shared with" value={`${job.shared_with} (you're ${job.role === "lead" ? "lead" : "2nd keeper"})`} />
        )}
      </Card>

      <Card shadow="sm" className="p-4 space-y-3">
        <DetailRow label="You earn" value={ngn(job.earning_kobo)} strong />
        {job.transport_fare_kobo != null && job.transport_fare_kobo > 0 && (
          <DetailRow label="Transport" value={ngn(job.transport_fare_kobo)} strong />
        )}
      </Card>
    </div>
  );
}

function DetailRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span
        className={`text-sm text-right tabular-nums ${strong ? "font-semibold" : ""}`}
        style={{ color: "var(--text-strong)" }}
      >
        {value}
      </span>
    </div>
  );
}

function BackIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>
  );
}
