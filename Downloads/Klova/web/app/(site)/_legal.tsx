import Link from "next/link";

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

      {/* WhatsApp contact bar */}
      <a
        href="https://wa.me/2348000000000"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-2xl border px-5 py-4 mb-10 hover:border-primary transition-colors duration-150 no-underline"
        style={{ borderColor: "var(--color-base-200)", background: "var(--surface-card)" }}
      >
        <svg className="w-5 h-5 shrink-0 text-success" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.16 5.373 5.495.038 12.05.038c3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.345.223-.643.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
        </svg>
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--text-strong)" }}>
            Questions about this page?
          </p>
          <p className="text-sm" style={{ color: "var(--color-primary)" }}>
            WhatsApp us at +234 800 000 0000
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
