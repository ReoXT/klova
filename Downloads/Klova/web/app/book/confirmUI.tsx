import type { ReactNode } from "react";

/**
 * Shared building blocks for the booking confirmation screen.
 *
 * Design language: section titles sit OUTSIDE soft cards, fields use a calm
 * label-above-value layout, and items are separated by whitespace rather than
 * hairline dividers. Headers use the body font (Plus Jakarta) since the display
 * serif reads too heavy at small sizes.
 */

export function Section({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h2
        className="text-[17px] font-semibold mb-3"
        style={{ color: "var(--text-strong)", fontFamily: "var(--font-body)" }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export function SoftCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 ${className}`}
      style={{
        borderColor: "var(--border-default)",
        background: "var(--surface-card)",
        boxShadow: "0 1px 2px oklch(0 0 0 / 0.03)",
      }}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs mb-1" style={{ color: "var(--text-subtle)" }}>
        {label}
      </p>
      <div className="text-[15px] font-medium leading-snug" style={{ color: "var(--text-strong)" }}>
        {children}
      </div>
    </div>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[13px] font-medium"
      style={{ background: "var(--color-base-200)", color: "var(--text-body)" }}
    >
      {children}
    </span>
  );
}
