"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Skeleton";

/* ── Types ─────────────────────────────────────────────────────────── */
interface Review {
  score: number;
  comment: string | null;
  created_at: string;
  customer_first_name: string | null;
}
interface CleanerRating {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  status: string;
  total_jobs: number;
  zone: { name: string } | null;
  review_count: number;
  avg_score: number | null;
  below_threshold: boolean;
  recent_reviews: Review[];
}

/* ── Helpers ────────────────────────────────────────────────────────── */
function fmtDate(date: string) {
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

/* ── Sub-components ─────────────────────────────────────────────────── */
function Stars({ score, size = "sm" }: { score: number; size?: "sm" | "lg" }) {
  const sz = size === "lg" ? "w-5 h-5" : "w-3.5 h-3.5";
  return (
    <span className="flex gap-0.5 items-center">
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          className={`${sz} shrink-0`}
          viewBox="0 0 24 24"
          fill={i < Math.round(score) ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={1.5}
          style={{ color: i < Math.round(score) ? "#f59e0b" : "var(--text-muted)" }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
          />
        </svg>
      ))}
    </span>
  );
}

function Avatar({ url, first, last }: { url: string | null; first: string; last: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt={`${first} ${last}`}
        className="rounded-full object-cover shrink-0 w-12 h-12"
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 w-12 h-12 font-semibold text-sm"
      style={{ background: "var(--color-primary)", color: "var(--color-primary-content)" }}
    >
      {initials(first, last)}
    </div>
  );
}

function CleanerCard({ c }: { c: CleanerRating }) {
  const [expanded, setExpanded] = useState(false);
  const flag = c.below_threshold;

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{
        background: "var(--surface-card)",
        boxShadow: "var(--shadow-sm)",
        border: flag ? "1.5px solid var(--color-error)" : "1.5px solid transparent",
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar url={c.photo_url} first={c.first_name} last={c.last_name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm" style={{ color: "var(--text-strong)" }}>
              {c.first_name} {c.last_name}
            </p>
            {c.status === "inactive" && (
              <span className="badge badge-soft badge-neutral text-xs">Inactive</span>
            )}
            {flag && (
              <span className="badge badge-soft badge-error text-xs font-semibold">
                Below 4.0 ★
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {c.zone?.name ?? "No zone"} · {c.total_jobs} job{c.total_jobs !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Score */}
      <div className="flex items-center gap-3">
        {c.avg_score !== null ? (
          <>
            <span
              className="text-3xl font-bold tabular-nums leading-none"
              style={{ color: flag ? "var(--color-error)" : "var(--text-strong)" }}
            >
              {c.avg_score.toFixed(1)}
            </span>
            <div className="flex flex-col gap-0.5">
              <Stars score={c.avg_score} size="lg" />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {c.review_count} review{c.review_count !== 1 ? "s" : ""}
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No reviews yet
          </p>
        )}
      </div>

      {/* Recent comments */}
      {c.recent_reviews.length > 0 && (
        <div className="space-y-2">
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Recent reviews
          </p>
          {(expanded ? c.recent_reviews : c.recent_reviews.slice(0, 2)).map((r, i) => (
            <div
              key={i}
              className="rounded-xl p-3 space-y-1"
              style={{ background: "oklch(0.97 0.003 240)" }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Stars score={r.score} size="sm" />
                <span className="text-xs font-medium" style={{ color: "var(--text-strong)" }}>
                  {r.score}/5
                </span>
                {r.customer_first_name && (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    · {r.customer_first_name}
                  </span>
                )}
                <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>
                  {fmtDate(r.created_at)}
                </span>
              </div>
              {r.comment ? (
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-body)" }}>
                  &ldquo;{r.comment}&rdquo;
                </p>
              ) : (
                <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
                  No comment left
                </p>
              )}
            </div>
          ))}
          {c.recent_reviews.length > 2 && (
            <button
              className="text-xs underline underline-offset-2"
              style={{ color: "var(--text-muted)" }}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Show less" : `Show ${c.recent_reviews.length - 2} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────── */
export default function AdminRatingsPage() {
  const [cleaners, setCleaners] = useState<CleanerRating[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/ratings")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setCleaners(d.cleaners ?? []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const flagged      = cleaners.filter((c) => c.below_threshold);
  const totalReviews = cleaners.reduce((s, c) => s + c.review_count, 0);
  const scored       = cleaners.filter((c) => c.avg_score !== null);
  const globalAvg    = scored.length
    ? scored.reduce((s, c) => s + (c.avg_score ?? 0), 0) / scored.length
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text-strong)" }}>
          Ratings
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Customer reviews per cleaner. Flagged in red if trending below 4.0 stars.
        </p>
      </div>

      {/* Summary strip */}
      {!loading && !error && cleaners.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Cleaners",      value: String(cleaners.length) },
            { label: "Total reviews", value: String(totalReviews) },
            { label: "Overall avg",   value: globalAvg !== null ? `${globalAvg.toFixed(1)} ★` : "-" },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl p-4"
              style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-wider mb-1"
                style={{ color: "var(--text-muted)" }}
              >
                {label}
              </p>
              <p className="text-2xl font-bold" style={{ color: "var(--text-strong)" }}>
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Flagged alert */}
      {flagged.length > 0 && (
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: "oklch(0.97 0.015 25)", border: "1px solid var(--color-error)" }}
        >
          <svg
            className="w-4 h-4 shrink-0"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ color: "var(--color-error)" }}
          >
            <path
              fillRule="evenodd"
              d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm font-medium" style={{ color: "var(--color-error)" }}>
            {flagged.length} cleaner{flagged.length > 1 ? "s" : ""} trending below 4.0. Action recommended.
          </p>
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div
          className="rounded-2xl p-6 text-center"
          style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}
        >
          <p className="text-sm" style={{ color: "var(--color-error)" }}>{error}</p>
        </div>
      ) : cleaners.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No cleaners found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cleaners.map((c) => (
            <CleanerCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
