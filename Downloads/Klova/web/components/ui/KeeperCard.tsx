import Image from "next/image";

export interface KeeperCardProps {
  firstName: string;
  photoUrl?: string | null;
  /** null or omitted → new cleaner, don't show a number */
  rating?: number | null;
  /** omitted or 0 → new cleaner, don't show a count */
  totalJobs?: number;
}

/** Star icon — filled, accent colour */
function Star({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor"
      style={{ color: "var(--klova-accent)" }}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

/** Shield + tick — Verified badge icon */
function Shield({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

/**
 * KeeperCard — shown to the customer once a cleaner is matched.
 * Always assumes verified (the API only surfaces verified, active cleaners).
 *
 * Handles missing data gracefully:
 * - No photo → initials avatar
 * - No rating / rating = 0 → omit rating row, show "New to Klova" instead
 * - No jobs / jobs = 0 → omit count (never shows "0 cleans")
 */
export function KeeperCard({ firstName, photoUrl, rating, totalJobs }: KeeperCardProps) {
  const initial = firstName.charAt(0).toUpperCase();
  const hasRating = typeof rating === "number" && rating > 0;
  const hasJobs   = typeof totalJobs === "number" && totalJobs > 0;
  const isNew     = !hasRating;

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        borderColor: "var(--border-default)",
        background:  "var(--surface-card)",
        boxShadow:   "var(--shadow-md)",
      }}
    >
      {/* ── Body ─────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-7 flex flex-col items-center text-center gap-0">

        {/* Avatar */}
        <div className="relative mb-4">
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={firstName}
              width={80}
              height={80}
              unoptimized
              className="w-20 h-20 rounded-full object-cover"
              style={{ boxShadow: "0 0 0 3px white, 0 0 0 5px var(--klova-success)" }}
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold select-none"
              style={{
                background:  "var(--klova-primary-soft)",
                color:       "var(--klova-primary)",
                boxShadow:   "0 0 0 3px white, 0 0 0 5px var(--klova-success)",
              }}
            >
              {initial}
            </div>
          )}

          {/* Tick badge on avatar */}
          <span
            className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center"
            style={{
              background: "var(--klova-success)",
              border:     "2px solid white",
            }}
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
        </div>

        {/* Name */}
        <p className="text-xl font-semibold mb-1" style={{ color: "var(--text-strong)" }}>
          {firstName}
        </p>

        {/* Rating + jobs — or "New to Klova" */}
        {(hasRating || hasJobs) ? (
          <div className="flex items-center gap-2">
            {hasRating && (
              <span className="flex items-center gap-1">
                <Star />
                <span className="text-sm font-semibold" style={{ color: "var(--klova-accent)" }}>
                  {(rating as number).toFixed(1)}
                </span>
              </span>
            )}
            {hasRating && hasJobs && (
              <span className="text-xs" style={{ color: "var(--text-subtle)" }}>·</span>
            )}
            {hasJobs && (
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                {(totalJobs as number).toLocaleString()} cleans
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-subtle)" }}>
            {isNew ? "New to Klova" : ""}
          </p>
        )}

        {/* Trust footnote */}
        <p className="text-xs mt-4 max-w-52 leading-relaxed" style={{ color: "var(--text-subtle)" }}>
          Your full contact details are shared once payment is confirmed.
        </p>
      </div>
    </div>
  );
}
