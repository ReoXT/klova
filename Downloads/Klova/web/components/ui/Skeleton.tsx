/* ── Skeleton — single block ──────────────────────────────── */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/* ── SkeletonText — stacked text lines ───────────────────── */

export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`skeleton h-4 ${i === lines - 1 ? "w-3/4" : "w-full"}`}
        />
      ))}
    </div>
  );
}

/* ── SkeletonCard — card placeholder with title + text + CTA ─ */

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`card bg-base-100 shadow-sm p-6 space-y-4 ${className}`}
      aria-hidden="true"
    >
      <div className="skeleton h-5 w-2/3 rounded" />
      <SkeletonText lines={3} />
      <div className="flex justify-between items-center pt-1">
        <div className="skeleton h-4 w-20" />
        <div className="skeleton h-9 w-24 rounded-lg" />
      </div>
    </div>
  );
}

/* ── SkeletonAvatar — circular avatar placeholder ──────────── */

export function SkeletonAvatar({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass = { sm: "w-8 h-8", md: "w-12 h-12", lg: "w-16 h-16" }[size];
  return (
    <div
      className={`skeleton rounded-full ${sizeClass} ${className}`}
      aria-hidden="true"
    />
  );
}

/* ── Spinner ──────────────────────────────────────────────── */

type SpinnerSize = "xs" | "sm" | "md" | "lg";

const spinnerSizeClass: Record<SpinnerSize, string> = {
  xs: "loading-xs",
  sm: "loading-sm",
  md: "loading-md",
  lg: "loading-lg",
};

export function Spinner({
  size = "md",
  label = "Loading…",
  className = "",
}: {
  size?: SpinnerSize;
  label?: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`loading loading-spinner text-primary ${spinnerSizeClass[size]} ${className}`}
    />
  );
}
