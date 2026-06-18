import Image from "next/image";
import Link from "next/link";

const LEGAL_LINKS = [
  { label: "Terms of Service",       href: "/terms" },
  { label: "Privacy Policy",         href: "/privacy" },
  { label: "Cancellation & Refunds", href: "/cancellation" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-base-300 bg-base-100 mt-auto">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-12">

        {/* Top row */}
        <div className="flex flex-col sm:flex-row sm:justify-between gap-8">

          {/* Brand */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Image src="/logo.svg" alt="" width={28} height={28} />
              <span className="wordmark text-2xl text-primary">Klova</span>
            </div>
            <p className="text-sm text-base-content/55 leading-relaxed max-w-xs">
              On-demand home cleaning for Lagos.<br />
              Personally trained, vetted, and rated.
            </p>
          </div>

          {/* Support */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-base-content/40 uppercase tracking-widest">
              Support
            </p>
            <a
              href="https://wa.me/2348000000000"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 text-sm text-base-content hover:text-primary transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded-sm"
            >
              {/* WhatsApp icon */}
              <svg
                className="w-4 h-4 text-success shrink-0"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.16 5.373 5.495.038 12.05.038c3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.345.223-.643.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
              WhatsApp us
            </a>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-10 pt-6 border-t border-base-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-xs text-base-content/40">© 2025 Klova. Lagos, Nigeria.</p>
          <nav aria-label="Legal links" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {LEGAL_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="text-xs text-base-content/50 hover:text-primary transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded-sm"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

      </div>
    </footer>
  );
}
