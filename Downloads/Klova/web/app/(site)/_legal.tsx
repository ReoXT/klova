import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/contact";

/* Shared shell used by all three legal pages */

export function LegalShell({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  const emailDisplay = SUPPORT_EMAIL || "[email not set, update lib/contact.ts]";
  const emailHref = SUPPORT_EMAIL ? `mailto:${SUPPORT_EMAIL}` : "#";

  return (
    <div className="max-w-2xl mx-auto px-5 sm:px-6 py-16 sm:py-24">
      {/* Eyebrow */}
      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
        Legal
      </p>

      {/* Title */}
      <h1 className="text-4xl font-bold mb-2" style={{ color: "var(--text-strong)" }}>
        {title}
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
        Last updated: {lastUpdated}
      </p>

      {/* Email contact bar */}
      <a
        href={emailHref}
        className="flex items-center gap-3 rounded-2xl border px-5 py-4 mb-10 hover:border-primary transition-colors duration-150 no-underline"
        style={{ borderColor: "var(--color-base-200)", background: "var(--surface-card)" }}
      >
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} style={{ color: "var(--color-primary)" }} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
        </svg>
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--text-strong)" }}>
            Questions about this page?
          </p>
          <p className="text-sm" style={{ color: "var(--color-primary)" }}>
            {emailDisplay}
          </p>
        </div>
        <svg className="w-4 h-4 ml-auto shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} style={{ color: "var(--text-muted)" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </a>

      {/* Page content */}
      <div className="space-y-8">
        {children}
      </div>

      {/* Bottom nav */}
      <div className="mt-16 pt-8 border-t flex flex-wrap gap-4 text-sm" style={{ borderColor: "var(--color-base-200)" }}>
        <Link href="/terms" className="hover:text-primary transition-colors" style={{ color: "var(--text-muted)" }}>Terms of Service</Link>
        <Link href="/privacy" className="hover:text-primary transition-colors" style={{ color: "var(--text-muted)" }}>Privacy Policy</Link>
        <Link href="/cancellation" className="hover:text-primary transition-colors" style={{ color: "var(--text-muted)" }}>Cancellation &amp; Refunds</Link>
      </div>
    </div>
  );
}

/* Individual section block */
export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold" style={{ color: "var(--text-strong)" }}>{heading}</h2>
      <div className="space-y-3 text-sm leading-7" style={{ color: "var(--text-body)" }}>
        {children}
      </div>
    </section>
  );
}

/* Amber callout for sections that need a lawyer's eye */
export function ReviewNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex gap-3 rounded-xl px-4 py-3 text-sm leading-relaxed not-prose"
      style={{ background: "oklch(0.97 0.04 85)", border: "1px solid oklch(0.88 0.09 85)" }}
    >
      <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" style={{ color: "oklch(0.6 0.14 75)" }}>
        <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
      </svg>
      <p style={{ color: "oklch(0.45 0.12 70)" }}>
        <strong>Professional review needed:</strong> {children}
      </p>
    </div>
  );
}

/* Bullet list */
export function Ul({ items }: { items: string[] }) {
  return (
    <ul className="pl-5 space-y-1.5 text-sm leading-7" style={{ color: "var(--text-body)", listStyleType: "disc" }}>
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}
