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
    <section className="relative overflow-hidden bg-base-100 min-h-[88vh] flex items-center">
      {/* Background orb — top right */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-48 -right-48 w-[700px] h-[700px] rounded-full"
        style={{ background: "radial-gradient(circle, oklch(0.29 0.09 152 / 0.08) 0%, transparent 60%)" }}
      />
      {/* Background orb — bottom left */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-40 w-[520px] h-[520px] rounded-full"
        style={{ background: "radial-gradient(circle, oklch(0.68 0.14 67 / 0.06) 0%, transparent 60%)" }}
      />

      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-20 lg:py-28 w-full">
        <div className="grid lg:grid-cols-[1fr_400px] gap-14 lg:gap-20 items-center">

          {/* ── Copy ── */}
          <div>
            <h1 className="fade-up fade-up-1 text-5xl sm:text-6xl lg:text-[4.5rem] leading-[1.04] text-primary mb-8">
              On-demand<br />
              housekeeping<br />
              you can trust.
            </h1>

            <p className="fade-up fade-up-2 text-lg sm:text-xl text-base-content/60 leading-relaxed max-w-md mb-10">
              Skilled, personally vetted Keepers matched to your home or office in minutes.{" "}
              <span className="text-base-content/80 font-semibold">Standard cleans from ₦5,000.</span>
            </p>

            <div className="fade-up fade-up-3 flex flex-col sm:flex-row gap-3 mb-14">
              <Link href="/book" className="btn btn-primary btn-lg gap-2 group sm:px-7">
                Book a Keeper
                <svg
                  className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
              <a href="#how-it-works" className="btn btn-ghost btn-lg text-base-content/60 hover:text-base-content">
                How it works
              </a>
            </div>

            {/* Trust signals */}
            <div className="fade-up fade-up-4 flex flex-wrap gap-x-7 gap-y-3 pt-7 border-t border-base-300">
              {[
                "Personally trained and vetted",
                "4.8 average rating",
                "Matched in under 2 minutes",
              ].map((text) => (
                <div key={text} className="flex items-center gap-2">
                  <svg
                    className="w-3.5 h-3.5 text-primary shrink-0"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-base-content/50">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Hero photo (desktop only) ── */}
          <div className="hidden lg:block fade-up fade-up-2">
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
      {/* Photo frame */}
      <div
        className="relative w-full rounded-3xl overflow-hidden"
        style={{
          aspectRatio: "3/4",
          background: "linear-gradient(155deg, oklch(0.94 0.008 85) 0%, oklch(0.90 0.014 85) 100%)",
          border: "1px solid oklch(0.90 0.015 85)",
          boxShadow: "0 32px 80px oklch(0.29 0.09 152 / 0.13), 0 4px 16px oklch(0.29 0.09 152 / 0.06)",
        }}
      >
        {/* Subtle inner vignette */}
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 100%, oklch(0.29 0.09 152 / 0.04) 0%, transparent 70%)" }}
        />
        {/* Person silhouette */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center"
            style={{ background: "oklch(0.86 0.012 85)" }}
          >
            <svg
              className="w-12 h-12"
              style={{ color: "oklch(0.74 0.012 85)" }}
              fill="currentColor" viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
            </svg>
          </div>
          <p className="text-xs font-medium tracking-wide" style={{ color: "oklch(0.68 0.01 85)" }}>
            Keeper photo coming soon
          </p>
        </div>
      </div>

      {/* Floating badge — rating */}
      <div
        className="hero-float absolute -left-8 top-[30%] bg-base-100 rounded-2xl border border-base-300 px-4 py-3.5"
        style={{ boxShadow: "0 8px 36px oklch(0.18 0.007 85 / 0.13)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "oklch(0.68 0.14 67 / 0.12)" }}
          >
            <svg
              className="w-4 h-4"
              style={{ color: "oklch(0.68 0.14 67)", fill: "currentColor" }}
              viewBox="0 0 24 24" aria-hidden="true"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-base-content leading-none mb-1">4.8 / 5</p>
            <p className="text-[11px] text-base-content/40 leading-none">Keeper rating</p>
          </div>
        </div>
      </div>

      {/* Floating badge — vetted */}
      <div
        className="hero-float-alt absolute -right-6 bottom-[28%] bg-base-100 rounded-2xl border border-base-300 px-4 py-3.5"
        style={{ boxShadow: "0 8px 36px oklch(0.18 0.007 85 / 0.13)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-success/10">
            <svg
              className="w-4 h-4 text-success"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-base-content leading-none mb-1">Vetted</p>
            <p className="text-[11px] text-base-content/40 leading-none">Every Keeper</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Keeper card (reused in Trust section) ────────────────────────────────────

function KeeperCard({ size = "md" }: { size?: "md" | "lg" }) {
  const isLg = size === "lg";
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-3xl -z-10"
        style={{ boxShadow: "0 0 80px oklch(0.29 0.09 152 / 0.10)" }}
      />
      <div className="bg-base-100 border border-base-300 rounded-2xl shadow-lg p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`${isLg ? "w-14 h-14" : "w-12 h-12"} rounded-xl flex items-center justify-center text-primary font-semibold shrink-0`}
              style={{ background: "oklch(0.29 0.09 152 / 0.11)", fontSize: isLg ? "1.1rem" : "0.95rem" }}
            >
              CO
            </div>
            <div>
              <p className="font-semibold text-base-content text-[15px] leading-tight">Chidi O.</p>
              <p className="text-sm text-base-content/45 mt-0.5">Lekki / Ajah</p>
            </div>
          </div>
          {/* Vetted badge */}
          <span className="flex items-center gap-1 bg-success/10 text-success text-[11px] font-semibold px-2 py-1 rounded-full leading-none">
            <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Vetted
          </span>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex gap-0.5" aria-label="4.8 out of 5 stars">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg
                key={i}
                className="w-3.5 h-3.5 fill-current"
                style={{ color: "oklch(0.68 0.14 67)" }}
                viewBox="0 0 24 24" aria-hidden="true"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            ))}
          </div>
          <span className="text-sm font-semibold text-base-content">4.8</span>
          <span className="text-sm text-base-content/35">· 42 jobs</span>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {["Interviewed", "Skill-tested", "Referenced"].map((tag) => (
            <span key={tag} className="text-[11px] text-base-content/50 bg-base-200 px-2.5 py-1 rounded-full border border-base-300">
              {tag}
            </span>
          ))}
        </div>

        <p className="text-[11px] text-base-content/30 border-t border-base-300 pt-4 leading-relaxed">
          You see this profile before you pay — every time, no exceptions.
        </p>
      </div>
    </div>
  );
}

// ─── Services ─────────────────────────────────────────────────────────────────

function Services() {
  return (
    <section id="services" className="bg-base-200 py-20 lg:py-28">
      <div className="max-w-6xl mx-auto px-5 sm:px-6">

        <div className="mb-12 lg:mb-14 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-base-content/35 mb-4">All services</p>
          <h2 className="text-4xl lg:text-5xl text-primary mb-4">
            Whatever the clean,<br className="hidden sm:inline" /> we've got you.
          </h2>
          <p className="text-base-content/60 text-lg leading-relaxed">
            Homes, offices, new builds, post-construction sites. Any size, any frequency. Add-ons available for laundry, ironing, and wardrobe organisation.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {SERVICES.map((svc) => (
            <ServiceCard key={svc.slug} svc={svc} />
          ))}
        </div>

        {/* Add-ons */}
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-sm text-base-content/45">
          <span className="font-semibold text-base-content/60 mr-1">Add-ons available:</span>
          {[
            ["Laundry", "₦3,500"],
            ["Ironing", "₦4,600"],
            ["Wardrobe organising", "₦4,000"],
          ].map(([name, price], i, arr) => (
            <span key={name}>
              {name}{" "}
              <span className="font-semibold text-base-content/70">{price}</span>
              {i < arr.length - 1 && <span className="mx-1.5 text-base-content/25">·</span>}
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
      className="relative block bg-base-100 rounded-2xl p-6 border border-base-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/20 transition-all duration-200 group"
    >
      {svc.popular && (
        <span className="absolute top-4 right-4 badge badge-accent badge-sm">Popular</span>
      )}

      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl mb-5 flex items-center justify-center shrink-0"
        style={{ background: "oklch(0.29 0.09 152 / 0.10)" }}
        aria-hidden="true"
      >
        <ServiceIcon slug={svc.slug} />
      </div>

      <h3 className="font-semibold text-base-content text-[15px] mb-2">{svc.name}</h3>
      <p className="wordmark text-2xl text-primary mb-3">From {svc.from}</p>
      <p className="text-sm text-base-content/50 leading-relaxed">{svc.desc}</p>
    </Link>
  );
}

function ServiceIcon({ slug }: { slug: string }) {
  const cls = "w-5 h-5 text-primary";
  if (slug === "standard") return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path strokeLinecap="round" d="M12 3v2M12 19v2M3 12h2M19 12h2M6.22 6.22l1.42 1.42M16.36 16.36l1.42 1.42M6.22 17.78l1.42-1.42M16.36 7.64l1.42-1.42" />
    </svg>
  );
  if (slug === "deep") return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0L12 2.69z" />
    </svg>
  );
  if (slug === "move") return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="0.75" />
      <rect x="14" y="3" width="7" height="7" rx="0.75" />
      <rect x="3" y="14" width="7" height="7" rx="0.75" />
      <rect x="14" y="14" width="7" height="7" rx="0.75" />
    </svg>
  );
}

// ─── Trust ────────────────────────────────────────────────────────────────────

function Trust() {
  return (
    <section id="keepers" className="bg-base-100 py-20 lg:py-28">
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <div className="grid lg:grid-cols-[1fr_360px] gap-12 lg:gap-20 items-start">

          {/* ── Copy ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-base-content/35 mb-4">Our Keepers</p>
            <h2 className="text-4xl lg:text-5xl text-primary mb-6">
              Your Keeper is vetted,<br className="hidden sm:inline" /> not just hired.
            </h2>
            <p className="text-lg text-base-content/60 leading-relaxed mb-10 max-w-lg">
              We don't send strangers to your home. Every Keeper on Klova has been personally
              trained, assessed in person, and reference-checked before they ever take a booking.
            </p>

            <div className="space-y-8">
              {TRUST_POINTS.map(({ title, body }) => (
                <div key={title} className="flex gap-4">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "oklch(0.29 0.09 152 / 0.10)" }}
                    aria-hidden="true"
                  >
                    <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-base-content text-[15px] mb-1">{title}</h3>
                    <p className="text-base-content/55 text-sm leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Differentiator callout */}
            <div
              className="mt-10 rounded-2xl p-5 border"
              style={{
                background: "oklch(0.68 0.14 67 / 0.07)",
                borderColor: "oklch(0.68 0.14 67 / 0.2)",
              }}
            >
              <p className="text-sm font-semibold text-base-content mb-1">
                You see who's coming before you pay.
              </p>
              <p className="text-sm text-base-content/55 leading-relaxed">
                Name, photo, star rating, completed jobs. This isn&apos;t a nice-to-have. It&apos;s how
                Klova works. Every booking, every time.
              </p>
            </div>
          </div>

          {/* ── Keeper card ── */}
          <div className="lg:sticky lg:top-24">
            <KeeperCard size="lg" />

            {/* Small reassurance below card */}
            <p className="text-xs text-base-content/35 text-center mt-5 leading-relaxed">
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
    <section
      id="how-it-works"
      className="py-20 lg:py-28"
      style={{ background: "oklch(0.29 0.09 152)" }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-6">

        <div className="mb-12 lg:mb-16">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-4"
            style={{ color: "oklch(0.97 0.01 152 / 0.45)" }}
          >
            The process
          </p>
          <h2
            className="text-4xl lg:text-5xl"
            style={{ color: "oklch(0.97 0.01 152)" }}
          >
            From booking to clean<br className="hidden sm:inline" /> in minutes.
          </h2>
        </div>

        {/* Steps */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 rounded-2xl overflow-hidden">
          {STEPS.map(({ n, title, body }) => (
            <div key={n} className="p-7 lg:p-8" style={{ background: "oklch(0.29 0.09 152)" }}>
              <p
                className="wordmark text-5xl lg:text-6xl mb-6 leading-none"
                style={{ color: "oklch(0.68 0.14 67)" }}
              >
                {n}
              </p>
              <h3
                className="font-semibold text-[15px] mb-2"
                style={{ color: "oklch(0.97 0.01 152)" }}
              >
                {title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "oklch(0.97 0.01 152 / 0.55)" }}
              >
                {body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/book"
            className="btn btn-lg gap-2 group"
            style={{
              background: "oklch(0.68 0.14 67)",
              color: "oklch(0.15 0.02 67)",
              border: "none",
            }}
          >
            Book your first clean
            <svg
              className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Zones ────────────────────────────────────────────────────────────────────

function Zones() {
  return (
    <section id="zones" className="bg-base-100 py-20 lg:py-28">
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">

          {/* ── Copy ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-base-content/35 mb-4">Where we operate</p>
            <h2 className="text-4xl lg:text-5xl text-primary mb-6">
              We're live in<br /> Lekki / Ajah.
            </h2>
            <p className="text-lg text-base-content/60 leading-relaxed mb-6 max-w-md">
              We launched deliberately in one zone. Not because we can&apos;t grow faster, but
              because we won&apos;t compromise on quality to do it.
            </p>
            <p className="text-base text-base-content/50 leading-relaxed max-w-md">
              Every Keeper in Lekki / Ajah has been personally vetted. Every booking is
              tracked. Once we've proven the standard here, Victoria Island, Ikeja, and
              Surulere are next.
            </p>

            {/* Honest early-stage note */}
            <div className="mt-8 flex gap-3 p-4 bg-base-200 rounded-xl border border-base-300">
              <svg className="w-5 h-5 text-base-content/30 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-base-content/50 leading-relaxed">
                <span className="font-semibold text-base-content/70">We just launched.</span>{" "}
                We&apos;re running a limited number of bookings per week right now, so every clean
                gets our full attention. Early customers get the best of what we&apos;ve built.
              </p>
            </div>
          </div>

          {/* ── Zone list ── */}
          <div className="space-y-3">
            {ZONES.map(({ name, live }) => (
              <div
                key={name}
                className={`flex items-center justify-between p-5 rounded-2xl border transition-colors ${
                  live
                    ? "bg-success/5 border-success/20"
                    : "bg-base-200 border-base-300"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      live ? "bg-success animate-pulse" : "bg-base-300"
                    }`}
                    aria-hidden="true"
                  />
                  <span className={`font-medium ${live ? "text-base-content" : "text-base-content/40"}`}>
                    {name}
                  </span>
                </div>
                {live ? (
                  <span className="badge badge-success badge-sm">Live</span>
                ) : (
                  <span className="text-xs text-base-content/30 font-medium">Coming soon</span>
                )}
              </div>
            ))}

            <p className="text-xs text-base-content/30 px-1 pt-2">
              Want us in your area sooner? Share Klova with someone in your neighbourhood. Demand is how we prioritise the next zone.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Availability ─────────────────────────────────────────────────────────────

function Availability() {
  return (
    <section id="availability" className="bg-base-200 py-20 lg:py-28">
      <div className="max-w-6xl mx-auto px-5 sm:px-6">

        <div className="grid lg:grid-cols-[auto_1fr] gap-12 lg:gap-20 items-center">

          {/* ── Large typographic number ── */}
          <div>
            <p
              className="wordmark leading-none text-primary select-none"
              style={{ fontSize: "clamp(6rem, 15vw, 11rem)" }}
              aria-hidden="true"
            >
              24<br />/7
            </p>
          </div>

          {/* ── Copy + time slots ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-base-content/35 mb-4">Availability</p>
            <h2 className="text-4xl lg:text-5xl text-primary mb-4">Any time. Any day.</h2>
            <p className="text-lg text-base-content/60 leading-relaxed mb-10 max-w-md">
              Weekday mornings, Sunday afternoons, late evenings after guests leave, Klova is here whenever your home needs attention.
            </p>

            {/* Scenario cards */}
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                {
                  time: "Morning",
                  hours: "06:00 – 12:00",
                  example: "Before work, every day of the week.",
                },
                {
                  time: "Afternoon",
                  hours: "12:00 – 18:00",
                  example: "While you're out, home is sorted by return.",
                },
                {
                  time: "Evening",
                  hours: "18:00 – 22:00",
                  example: "Post-dinner, post-party, post-guests.",
                },
              ].map(({ time, hours, example }) => (
                <div key={time} className="bg-base-100 rounded-xl border border-base-300 p-4">
                  <p className="font-semibold text-base-content text-[15px] mb-1">{time}</p>
                  <p className="text-xs font-medium text-primary mb-2">{hours}</p>
                  <p className="text-xs text-base-content/45 leading-relaxed">{example}</p>
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
    <section
      className="py-20 lg:py-28"
      style={{ background: "oklch(0.29 0.09 152)" }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-6 text-center">
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-6"
          style={{ color: "oklch(0.97 0.01 152 / 0.40)" }}
        >
          Ready?
        </p>
        <h2
          className="text-4xl sm:text-5xl lg:text-6xl mb-5"
          style={{ color: "oklch(0.97 0.01 152)" }}
        >
          Your home deserves better.
        </h2>
        <p
          className="text-lg sm:text-xl mb-10 max-w-md mx-auto leading-relaxed"
          style={{ color: "oklch(0.97 0.01 152 / 0.55)" }}
        >
          Meet the Keeper coming to you and book your first clean today.
        </p>

        <Link
          href="/book"
          className="btn btn-lg gap-2 group mb-8"
          style={{
            background: "oklch(0.68 0.14 67)",
            color: "oklch(0.15 0.02 67)",
            border: "none",
          }}
        >
          Book a Keeper
          <svg
            className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>

        {/* Trust micro-line */}
        <p
          className="text-sm"
          style={{ color: "oklch(0.97 0.01 152 / 0.30)" }}
        >
          Personally vetted Keepers · Secure payment via Paystack · No subscription required
        </p>
      </div>
    </section>
  );
}
