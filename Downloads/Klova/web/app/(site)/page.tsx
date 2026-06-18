import Link from "next/link";

// ─── Static data ──────────────────────────────────────────────────────────────

const SERVICES = [
  {
    slug: "standard",
    name: "Standard Clean",
    from: "₦5,000",
    desc: "Regular upkeep for any home. Surfaces, floors, bathrooms, kitchen. Great for weekly visits.",
    popular: false,
  },
  {
    slug: "deep",
    name: "Deep Clean",
    from: "₦18,500",
    desc: "Top-to-bottom intensive. Every corner, every surface. The kind of clean you feel walking in.",
    popular: true,
  },
  {
    slug: "move",
    name: "Move-in / Move-out",
    from: "₦40,000",
    desc: "Arrive to spotless or leave one behind. Perfect for tenants, landlords, and agents.",
    popular: false,
  },
  {
    slug: "post",
    name: "Post-construction",
    from: "₦45,000",
    desc: "Dust, debris, paint residue. Completely cleared after any renovation or new build.",
    popular: false,
  },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Tell us what you need",
    body: "Choose your service, apartment size, preferred date, and address. Under two minutes.",
  },
  {
    n: "02",
    title: "Get matched instantly",
    body: "Our system finds the best available Keeper in your area. No waiting, no back-and-forth.",
  },
  {
    n: "03",
    title: "See who's coming",
    body: "Name, photo, star rating, and completed jobs. All visible before you pay a naira.",
  },
  {
    n: "04",
    title: "Pay, then relax",
    body: "Secure payment via card or bank transfer. Your Keeper shows up. Your home is sorted.",
  },
] as const;

const ZONES = [
  { name: "Lekki / Ajah", live: true },
  { name: "Victoria Island", live: false },
  { name: "Ikeja", live: false },
  { name: "Surulere", live: false },
] as const;

const TRUST_POINTS = [
  {
    title: "Personally trained",
    body: "Every Keeper goes through hands-on training and a skills assessment before their first booking. We know exactly who is entering your home.",
  },
  {
    title: "In-person vetted",
    body: "Interviewed, skill-assessed, and reference-checked. If they don't meet the standard, they don't join.",
  },
  {
    title: "Rated after every job",
    body: "Real scores from real customers. Their rating and job count are visible to you before you pay.",
  },
] as const;

const ARROW = (
  <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
  </svg>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <>
      <Hero />
      <Services />
      <Trust />
      <HowItWorks />
      <Zones />
      <Availability />
      <FinalCTA />
    </>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden min-h-[82vh] flex items-center" style={{ background: "var(--surface-page)" }}>
      <div aria-hidden="true" className="pointer-events-none absolute -top-48 -right-48 w-[700px] h-[700px] rounded-full" style={{ background: "radial-gradient(circle, oklch(0.29 0.09 152 / 0.08) 0%, transparent 60%)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-40 w-[520px] h-[520px] rounded-full" style={{ background: "radial-gradient(circle, oklch(0.68 0.14 67 / 0.10) 0%, transparent 60%)" }} />

      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-20 lg:py-28 w-full">
        <div className="hero-grid">

          {/* Copy */}
          <div>
            {/* Amber accent rule — editorial mark above headline */}
            <div className="fade-up fade-up-1 mb-6" aria-hidden="true" style={{ width: "2.5rem", height: "3px", borderRadius: "9999px", background: "var(--klova-accent)" }} />

            <h1 className="fade-up fade-up-1 leading-[1.04] text-primary mb-8" style={{ fontSize: "clamp(2.75rem, 7vw, 4.5rem)" }}>
              On-demand<br />
              housekeeping<br />
              you can trust.
            </h1>

            <p className="fade-up fade-up-2 text-lg sm:text-xl leading-relaxed max-w-md mb-10" style={{ color: "var(--text-muted)" }}>
              Skilled, personally vetted Keepers matched to your home or office in minutes.{" "}
              <span className="font-semibold" style={{ color: "var(--text-body)" }}>Standard cleans from <span style={{ color: "var(--klova-accent)" }}>₦5,000</span>.</span>
            </p>

            <div className="fade-up fade-up-3 flex flex-col sm:flex-row gap-3 mb-14">
              <Link href="/book" className="btn btn-primary btn-lg gap-2 group sm:px-7">
                Book a Keeper
                {ARROW}
              </Link>
              <a href="#how-it-works" className="btn btn-ghost btn-lg" style={{ color: "var(--text-muted)" }}>
                How it works
              </a>
            </div>

            <div className="fade-up fade-up-4 flex flex-wrap gap-x-7 gap-y-3 pt-7" style={{ borderTop: "1px solid var(--border-default)" }}>
              {["Personally trained and vetted", "4.8 average rating", "Matched in under 2 minutes"].map((text) => (
                <div key={text} className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm" style={{ color: "var(--text-subtle)" }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hero photo — hidden on mobile via .hero-photo class */}
          <div className="hero-photo fade-up fade-up-2">
            <HeroPhoto />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Hero photo placeholder ───────────────────────────────────────────────────

function HeroPhoto() {
  return (
    <div className="relative">
      <div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: "3/4",
          borderRadius: "var(--radius-xl)",
          background: "linear-gradient(155deg, oklch(0.94 0.008 85) 0%, oklch(0.90 0.014 85) 100%)",
          border: "1px solid oklch(0.90 0.015 85)",
          boxShadow: "var(--shadow-hero)",
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ background: "oklch(0.86 0.012 85)" }}>
            <svg className="w-12 h-12" style={{ color: "oklch(0.74 0.012 85)" }} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
            </svg>
          </div>
          <p className="text-xs font-medium tracking-wide" style={{ color: "oklch(0.68 0.01 85)" }}>Keeper photo coming soon</p>
        </div>
      </div>

      {/* Rating badge */}
      <div className="hero-float absolute -left-8 top-[30%] rounded-2xl p-3.5" style={{ background: "var(--surface-card)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-float)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--klova-accent-soft)" }}>
            <svg className="w-4 h-4" style={{ color: "var(--klova-accent)", fill: "currentColor" }} viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold leading-none mb-1" style={{ color: "var(--klova-accent)" }}>4.8 / 5</p>
            <p className="text-[11px] leading-none" style={{ color: "var(--text-subtle)" }}>Keeper rating</p>
          </div>
        </div>
      </div>

      {/* Vetted badge */}
      <div className="hero-float-alt absolute -right-6 bottom-[28%] rounded-2xl p-3.5" style={{ background: "var(--surface-card)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-float)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--klova-success-soft)", color: "var(--klova-success)" }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold leading-none mb-1" style={{ color: "var(--text-strong)" }}>Vetted</p>
            <p className="text-[11px] leading-none" style={{ color: "var(--text-subtle)" }}>Every Keeper</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Keeper card ──────────────────────────────────────────────────────────────

function KeeperCard({ size = "md" }: { size?: "md" | "lg" }) {
  const isLg = size === "lg";
  const av = isLg ? "3.5rem" : "3rem";
  return (
    <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", padding: "1.5rem" }}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div style={{ width: av, height: av, borderRadius: "var(--radius-box)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--klova-primary-soft)", color: "var(--klova-primary)", fontWeight: 600, fontSize: isLg ? "1.1rem" : "0.95rem" }}>
            CO
          </div>
          <div>
            <p className="font-semibold text-[15px] leading-tight" style={{ color: "var(--text-strong)" }}>Chidi O.</p>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-subtle)" }}>Lekki / Ajah</p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full leading-none" style={{ background: "var(--klova-success-soft)", color: "var(--klova-success)" }}>
          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Vetted
        </span>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="flex gap-0.5" aria-label="4.8 out of 5 stars">
          {Array.from({ length: 5 }).map((_, i) => (
            <svg key={i} className="w-3.5 h-3.5" style={{ fill: "var(--klova-accent)" }} viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          ))}
        </div>
        <span className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>4.8</span>
        <span className="text-sm" style={{ color: "var(--text-subtle)" }}>· 42 jobs</span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-5">
        {["Interviewed", "Skill-tested", "Referenced"].map((tag) => (
          <span key={tag} className="text-[11px] px-2.5 py-1 rounded-full" style={{ color: "var(--text-muted)", background: "var(--surface-section)", border: "1px solid var(--border-default)" }}>
            {tag}
          </span>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed pt-4" style={{ color: "var(--text-subtle)", borderTop: "1px solid var(--border-default)" }}>
        You see this profile before you pay — every time, no exceptions.
      </p>
    </div>
  );
}

// ─── Services ─────────────────────────────────────────────────────────────────

function Services() {
  return (
    <section id="services" className="py-20 lg:py-28" style={{ background: "var(--surface-section)" }}>
      <div className="max-w-6xl mx-auto px-5 sm:px-6">

        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-subtle)", letterSpacing: "0.18em" }}>All services</p>
          <h2 className="text-4xl lg:text-5xl text-primary mb-4">
            Whatever the clean,<br className="hidden sm:inline" /> we&apos;ve got you.
          </h2>
          <p className="text-lg leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Homes, offices, new builds, post-construction sites. Any size, any frequency. Add-ons available for laundry, ironing, and wardrobe organisation.
          </p>
        </div>

        <div className="svc-grid mb-8">
          {SERVICES.map((svc) => (
            <ServiceCard key={svc.slug} svc={svc} />
          ))}
        </div>

        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-sm" style={{ color: "var(--text-subtle)" }}>
          <span className="font-semibold mr-1" style={{ color: "var(--text-muted)" }}>Add-ons available:</span>
          {[["Laundry", "₦3,500"], ["Ironing", "₦4,600"], ["Wardrobe organising", "₦4,000"]].map(([name, price], i, arr) => (
            <span key={name}>
              {name}{" "}
              <span className="font-semibold" style={{ color: "var(--text-body)" }}>{price}</span>
              {i < arr.length - 1 && <span className="mx-1.5" style={{ color: "var(--border-strong)" }}>·</span>}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function ServiceCard({ svc }: { svc: typeof SERVICES[number] }) {
  return (
    <Link
      href="/book"
      className="relative block p-6 hover:-translate-y-1 transition-all duration-200 group"
      style={{ background: "var(--surface-card)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-sm)", textDecoration: "none", display: "block" }}
    >
      {svc.popular && (
        <span className="absolute top-4 right-4 badge badge-accent badge-sm">Popular</span>
      )}
      <div className="w-10 h-10 rounded-xl mb-5 flex items-center justify-center shrink-0" style={{ background: "var(--klova-primary-soft)" }} aria-hidden="true">
        <ServiceIcon slug={svc.slug} />
      </div>
      <h3 className="font-semibold text-[15px] mb-2" style={{ color: "var(--text-strong)" }}>{svc.name}</h3>
      <p className="wordmark text-2xl text-primary mb-3">From {svc.from}</p>
      <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{svc.desc}</p>
    </Link>
  );
}

function ServiceIcon({ slug }: { slug: string }) {
  const p = { className: "w-5 h-5", fill: "none", viewBox: "0 0 24 24", stroke: "var(--klova-primary)", strokeWidth: 1.5, "aria-hidden": true as const };
  if (slug === "standard") return <svg {...p}><circle cx="12" cy="12" r="3" /><path strokeLinecap="round" d="M12 3v2M12 19v2M3 12h2M19 12h2M6.22 6.22l1.42 1.42M16.36 16.36l1.42 1.42M6.22 17.78l1.42-1.42M16.36 7.64l1.42-1.42" /></svg>;
  if (slug === "deep") return <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0L12 2.69z" /></svg>;
  if (slug === "move") return <svg {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" /></svg>;
  return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="0.75" /><rect x="14" y="3" width="7" height="7" rx="0.75" /><rect x="3" y="14" width="7" height="7" rx="0.75" /><rect x="14" y="14" width="7" height="7" rx="0.75" /></svg>;
}

// ─── Trust ────────────────────────────────────────────────────────────────────

function Trust() {
  return (
    <section id="keepers" className="py-20 lg:py-28" style={{ background: "var(--surface-page)" }}>
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <div className="trust-grid">

          <div>
            <p className="text-xs font-semibold uppercase mb-4" style={{ color: "var(--text-subtle)", letterSpacing: "0.18em" }}>Our Keepers</p>
            <h2 className="text-4xl lg:text-5xl text-primary mb-6">
              Your Keeper is vetted,<br className="hidden sm:inline" /> not just hired.
            </h2>
            <p className="text-lg leading-relaxed mb-10 max-w-lg" style={{ color: "var(--text-muted)" }}>
              We don&apos;t send strangers to your home. Every Keeper on Klova has been personally
              trained, assessed in person, and reference-checked before they ever take a booking.
            </p>

            <div className="space-y-8">
              {TRUST_POINTS.map(({ title, body }) => (
                <div key={title} className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "var(--klova-primary-soft)" }} aria-hidden="true">
                    <svg className="w-4 h-4" style={{ color: "var(--klova-primary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[15px] mb-1" style={{ color: "var(--text-strong)" }}>{title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="trust-card">
            <KeeperCard size="lg" />
            <p className="text-xs text-center mt-5 leading-relaxed" style={{ color: "var(--text-subtle)" }}>
              Sample Keeper profile — what you see before paying.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 lg:py-28" style={{ background: "var(--klova-primary)" }}>
      <div className="max-w-6xl mx-auto px-5 sm:px-6">

        <div className="mb-12 lg:mb-16">
          <p className="text-xs font-semibold uppercase mb-4" style={{ color: "oklch(0.97 0.01 152 / 0.45)", letterSpacing: "0.18em" }}>The process</p>
          <h2 className="text-4xl lg:text-5xl" style={{ color: "oklch(0.97 0.01 152)" }}>
            From booking to clean<br className="hidden sm:inline" /> in minutes.
          </h2>
        </div>

        <div className="steps-grid rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.10)", gap: "1px" }}>
          {STEPS.map(({ n, title, body }) => (
            <div key={n} className="p-7 lg:p-8" style={{ background: "var(--klova-primary)" }}>
              <p className="wordmark leading-none mb-6" style={{ fontSize: "clamp(3rem, 5vw, 3.5rem)", color: "var(--klova-accent)" }}>{n}</p>
              <h3 className="font-semibold text-[15px] mb-2" style={{ color: "oklch(0.97 0.01 152)" }}>{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "oklch(0.97 0.01 152 / 0.55)" }}>{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="/book" className="btn btn-lg gap-2 group" style={{ background: "var(--klova-accent)", color: "var(--klova-accent-content)", border: "none" }}>
            Book your first clean
            {ARROW}
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Zones ────────────────────────────────────────────────────────────────────

function Zones() {
  return (
    <section id="zones" className="py-20 lg:py-28" style={{ background: "var(--surface-page)" }}>
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <div className="zones-grid">

          <div>
            <p className="text-xs font-semibold uppercase mb-4" style={{ color: "var(--text-subtle)", letterSpacing: "0.18em" }}>Where we operate</p>
            <h2 className="text-4xl lg:text-5xl text-primary mb-6">
              We&apos;re live in<br /> Lekki / Ajah.
            </h2>
            <p className="text-lg leading-relaxed mb-6 max-w-md" style={{ color: "var(--text-muted)" }}>
              We launched deliberately in one zone. Not because we can&apos;t grow faster, but
              because we won&apos;t compromise on quality to do it.
            </p>
            <p className="text-base leading-relaxed max-w-md" style={{ color: "var(--text-subtle)" }}>
              Every Keeper in Lekki / Ajah has been personally vetted. Once we&apos;ve proven the
              standard here, Victoria Island, Ikeja, and Surulere are next.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {ZONES.map(({ name, live }) => (
              <div
                key={name}
                className="flex items-center justify-between p-5 rounded-2xl"
                style={{
                  border: live ? "1px solid oklch(0.58 0.14 155 / 0.20)" : "1px solid var(--border-default)",
                  background: live ? "var(--klova-success-soft)" : "var(--surface-section)",
                }}
              >
                <div className="flex items-center gap-3.5">
                  <span
                    className={live ? "pulse-dot" : ""}
                    style={{ width: "0.625rem", height: "0.625rem", borderRadius: "50%", flexShrink: 0, background: live ? "var(--klova-success)" : "var(--border-strong)" }}
                    aria-hidden="true"
                  />
                  <span className="font-medium" style={{ color: live ? "var(--text-strong)" : "var(--text-subtle)" }}>{name}</span>
                </div>
                {live ? (
                  <span className="badge badge-success badge-sm">Live</span>
                ) : (
                  <span className="text-xs font-medium" style={{ color: "var(--text-subtle)" }}>Coming soon</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Availability ─────────────────────────────────────────────────────────────

function Availability() {
  return (
    <section id="availability" className="py-20 lg:py-28" style={{ background: "var(--surface-section)" }}>
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <div className="avail-grid">

          <p className="wordmark leading-none text-primary select-none" style={{ fontSize: "clamp(6rem, 14vw, 11rem)" }} aria-hidden="true">
            24<br />/7
          </p>

          <div>
            <p className="text-xs font-semibold uppercase mb-4" style={{ color: "var(--text-subtle)", letterSpacing: "0.18em" }}>Availability</p>
            <h2 className="text-4xl lg:text-5xl text-primary mb-4">Any time. Any day.</h2>
            <p className="text-lg leading-relaxed mb-10 max-w-md" style={{ color: "var(--text-muted)" }}>
              Weekday mornings, Sunday afternoons, late evenings after guests leave, Klova is here whenever your home needs attention.
            </p>

            <div className="slots-grid">
              {[
                { time: "Morning", hours: "06:00 – 12:00", example: "Before work, every day of the week." },
                { time: "Afternoon", hours: "12:00 – 18:00", example: "While you're out, home is sorted by return." },
                { time: "Evening", hours: "18:00 – 22:00", example: "Post-dinner, post-party, post-guests." },
              ].map(({ time, hours, example }) => (
                <div key={time} className="rounded-xl p-4" style={{ background: "var(--surface-card)", border: "1px solid var(--border-default)" }}>
                  <p className="font-semibold text-[15px] mb-1" style={{ color: "var(--text-strong)" }}>{time}</p>
                  <p className="text-xs font-medium mb-2" style={{ color: "var(--klova-primary)" }}>{hours}</p>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-subtle)" }}>{example}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="py-20 lg:py-28" style={{ background: "var(--klova-primary)" }}>
      <div className="max-w-6xl mx-auto px-5 sm:px-6 text-center">
        <p className="text-xs font-semibold uppercase mb-6" style={{ color: "oklch(0.97 0.01 152 / 0.40)", letterSpacing: "0.18em" }}>
          Ready?
        </p>
        <h2 style={{ fontSize: "clamp(2.25rem, 5vw, 3.75rem)", color: "oklch(0.97 0.01 152)", marginBottom: "1.25rem", lineHeight: 1.08 }}>
          Your home deserves better.
        </h2>
        <p className="text-lg sm:text-xl mb-10 max-w-md mx-auto leading-relaxed" style={{ color: "oklch(0.97 0.01 152 / 0.55)" }}>
          Meet the Keeper coming to you and book your first clean today.
        </p>
        <Link href="/book" className="btn btn-lg gap-2 group" style={{ background: "var(--klova-accent)", color: "var(--klova-accent-content)", border: "none" }}>
          Book a Keeper
          {ARROW}
        </Link>
      </div>
    </section>
  );
}
