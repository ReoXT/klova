import type { Metadata } from "next";
import Link from "next/link";

import { Button }                                           from "@/components/ui/Button";
import { FormField, SelectField }                           from "@/components/ui/FormField";
import { Card, CardBody }                                   from "@/components/ui/Card";
import { Skeleton, SkeletonText, SkeletonCard, SkeletonAvatar, Spinner } from "@/components/ui/Skeleton";
import { EmptyState }                                       from "@/components/ui/EmptyState";
import { Alert }                                            from "@/components/ui/Alert";
import { AlertDismissDemo }                                 from "./_components/AlertDismissDemo";

export const metadata: Metadata = {
  title: "Design System — Klova",
};

/* ── Internal helpers ─────────────────────────────────────── */

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl text-base-content shrink-0">{title}</h2>
        <div className="flex-1 h-px bg-base-300" />
      </div>
      {children}
    </section>
  );
}

function Swatch({
  name,
  bg,
  text,
  border = "",
  label,
}: {
  name: string;
  bg: string;
  text: string;
  border?: string;
  label: string;
}) {
  return (
    <div className={`rounded-xl overflow-hidden ${border}`}>
      <div className={`${bg} h-20`} />
      <div className="bg-base-100 px-3 py-2.5 border-t border-base-300">
        <p className="text-xs font-semibold text-base-content">{name}</p>
        <code className="text-xs text-base-content/50">{label}</code>
      </div>
    </div>
  );
}

function Label({ children }: { children: string }) {
  return (
    <code className="text-xs font-mono bg-base-200 text-base-content/60 px-1.5 py-0.5 rounded-md">
      {children}
    </code>
  );
}

function FieldRow({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className={`text-sm font-medium ${error ? "text-error" : "text-base-content"}`}>
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-base-content/50">{hint}</p>}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────── */

const NAV_LINKS = [
  { id: "colors",        label: "Colors" },
  { id: "typography",    label: "Type" },
  { id: "buttons",       label: "Buttons" },
  { id: "forms",         label: "Forms" },
  { id: "cards",         label: "Cards" },
  { id: "badges",        label: "Badges" },
  { id: "alerts",        label: "Alerts" },
  { id: "shadows",       label: "Shadows" },
  { id: "ui-button",     label: "ui/Button" },
  { id: "ui-formfield",  label: "ui/FormField" },
  { id: "ui-card",       label: "ui/Card" },
  { id: "ui-loading",    label: "ui/Loading" },
  { id: "ui-emptystate", label: "ui/EmptyState" },
  { id: "ui-alert",      label: "ui/Alert" },
];

export default function StyleGuidePage() {
  return (
    <div className="min-h-screen bg-base-200">

      {/* ── Sticky nav ─────────────────────────────────── */}
      <nav className="sticky top-0 z-10 bg-base-100/90 backdrop-blur-sm border-b border-base-300">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="wordmark text-xl text-primary">Klova</Link>
            <span className="text-base-content/30 select-none">/</span>
            <span className="text-sm text-base-content/50">Design System</span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-xs text-base-content/50 overflow-x-auto">
            {NAV_LINKS.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className="hover:text-primary whitespace-nowrap transition-colors duration-150"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────── */}
      <div className="bg-primary text-primary-content">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <p className="text-xs tracking-widest uppercase opacity-50 mb-5">Design System · v1.0</p>
          <h1 className="text-6xl mb-5">Klova</h1>
          <p className="text-lg opacity-75 max-w-lg leading-relaxed">
            Clean, trustworthy, Lagos-premium. The tokens, fonts, and components that build every page.
          </p>
          <div className="flex gap-6 mt-12 text-sm opacity-60">
            <div>
              <p className="font-semibold opacity-100 text-primary-content">DM Serif Display</p>
              <p>Headings</p>
            </div>
            <div className="w-px bg-primary-content/20" />
            <div>
              <p className="font-semibold opacity-100 text-primary-content">Plus Jakarta Sans</p>
              <p>Body & UI</p>
            </div>
            <div className="w-px bg-primary-content/20" />
            <div>
              <p className="font-semibold opacity-100 text-primary-content">daisyUI v5</p>
              <p>Component layer</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-16 space-y-20">

        {/* ── COLORS ─────────────────────────────────── */}
        <Section id="colors" title="Color Palette">
          <div className="space-y-3">
            <p className="text-sm text-base-content/60">
              A warm palette built for trust. Deep forest green anchors the brand; stone and amber add warmth without noise.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Swatch name="Primary" bg="bg-primary" text="text-primary-content" label="--color-primary" />
              <Swatch name="Secondary" bg="bg-secondary" text="text-secondary-content" label="--color-secondary" />
              <Swatch name="Accent" bg="bg-accent" text="text-accent-content" label="--color-accent" />
              <Swatch name="Neutral" bg="bg-neutral" text="text-neutral-content" label="--color-neutral" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Swatch name="Base 100" bg="bg-base-100" text="text-base-content" border="border border-base-300" label="--color-base-100" />
              <Swatch name="Base 200" bg="bg-base-200" text="text-base-content" label="--color-base-200" />
              <Swatch name="Base 300" bg="bg-base-300" text="text-base-content" label="--color-base-300" />
              <Swatch name="Base Content" bg="bg-base-content" text="text-base-100" label="--color-base-content" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Swatch name="Info" bg="bg-info" text="text-info-content" label="--color-info" />
              <Swatch name="Success" bg="bg-success" text="text-success-content" label="--color-success" />
              <Swatch name="Warning" bg="bg-warning" text="text-warning-content" label="--color-warning" />
              <Swatch name="Error" bg="bg-error" text="text-error-content" label="--color-error" />
            </div>
          </div>
        </Section>

        {/* ── TYPOGRAPHY ─────────────────────────────── */}
        <Section id="typography" title="Typography">
          <div className="space-y-4">

            {/* Headings */}
            <div className="card bg-base-100 p-8 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <Label>font-heading</Label>
                <span className="text-xs text-base-content/40">DM Serif Display · Headings only</span>
              </div>
              {[
                { size: "text-5xl", sample: "On-demand cleaning, done right." },
                { size: "text-4xl", sample: "Vetted, rated, and trusted cleaners." },
                { size: "text-3xl", sample: "Your home, professionally cleaned." },
                { size: "text-2xl", sample: "Standard Clean · 2-bedroom" },
                { size: "text-xl",  sample: "Lekki / Ajah · Victoria Island" },
              ].map(({ size, sample }) => (
                <div key={size}>
                  <Label>{size}</Label>
                  <p className={`${size} text-base-content mt-1.5 leading-tight`}>{sample}</p>
                </div>
              ))}
            </div>

            {/* Body */}
            <div className="card bg-base-100 p-8 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <Label>font-body</Label>
                <span className="text-xs text-base-content/40">Plus Jakarta Sans · Body & UI</span>
              </div>
              <div>
                <Label>text-lg font-semibold</Label>
                <p className="text-lg font-semibold text-base-content mt-1.5">
                  Adaeze will arrive between 9:00 – 9:30 AM on Friday.
                </p>
              </div>
              <div>
                <Label>text-base</Label>
                <p className="text-base text-base-content mt-1.5 max-w-2xl leading-relaxed">
                  All our cleaners are NIN-verified, background-checked, and rated by real customers.
                  You&apos;ll see exactly who&apos;s coming before they arrive — name, photo, rating, and
                  number of completed cleans.
                </p>
              </div>
              <div>
                <Label>text-sm text-base-content/70</Label>
                <p className="text-sm text-base-content/70 mt-1.5">
                  Booking ref: KL-2024-00142 · Paid ₦24,000 · Dec 18, 2024 · Standard Clean
                </p>
              </div>
              <div>
                <Label>text-xs uppercase tracking-wider</Label>
                <p className="text-xs text-base-content/50 uppercase tracking-wider mt-1.5">
                  Service type · Standard clean · Lekki/Ajah zone
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* ── BUTTONS (daisyUI raw) ───────────────────── */}
        <Section id="buttons" title="Buttons (raw daisyUI)">
          <div className="space-y-4">
            <div className="card bg-base-100 p-8">
              <p className="text-xs text-base-content/40 uppercase tracking-wider mb-5">Semantic variants</p>
              <div className="flex flex-wrap gap-3">
                <button className="btn btn-primary">Primary</button>
                <button className="btn btn-secondary">Secondary</button>
                <button className="btn btn-accent">Accent</button>
                <button className="btn btn-neutral">Neutral</button>
                <button className="btn btn-ghost">Ghost</button>
                <button className="btn btn-link">Link</button>
              </div>
            </div>
            <div className="card bg-base-100 p-8">
              <p className="text-xs text-base-content/40 uppercase tracking-wider mb-5">Outline variants</p>
              <div className="flex flex-wrap gap-3">
                <button className="btn btn-primary btn-outline">Primary</button>
                <button className="btn btn-secondary btn-outline">Secondary</button>
                <button className="btn btn-accent btn-outline">Accent</button>
                <button className="btn btn-neutral btn-outline">Neutral</button>
              </div>
            </div>
            <div className="card bg-base-100 p-8">
              <p className="text-xs text-base-content/40 uppercase tracking-wider mb-5">Sizes</p>
              <div className="flex flex-wrap items-center gap-3">
                <button className="btn btn-primary btn-lg">Large</button>
                <button className="btn btn-primary">Default</button>
                <button className="btn btn-primary btn-sm">Small</button>
                <button className="btn btn-primary btn-xs">X-Small</button>
              </div>
            </div>
            <div className="card bg-base-100 p-8">
              <p className="text-xs text-base-content/40 uppercase tracking-wider mb-5">States</p>
              <div className="flex flex-wrap gap-3">
                <button className="btn btn-primary">Default</button>
                <button className="btn btn-primary" disabled>Disabled</button>
                <button className="btn btn-primary">
                  <span className="loading loading-spinner loading-sm" />
                  Booking...
                </button>
                <button className="btn btn-primary btn-wide">Wide / CTA</button>
              </div>
            </div>
          </div>
        </Section>

        {/* ── FORM ELEMENTS (raw daisyUI) ─────────────── */}
        <Section id="forms" title="Form Elements (raw daisyUI)">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="card bg-base-100 p-8 space-y-6">
              <p className="text-xs text-base-content/40 uppercase tracking-wider">Text Inputs</p>
              <FieldRow label="Full name">
                <input type="text" className="input w-full" placeholder="Adaeze Okonkwo" />
              </FieldRow>
              <FieldRow label="Phone number" hint="We'll send your confirmation here">
                <input type="tel" className="input w-full" placeholder="0803 000 0000" />
              </FieldRow>
              <FieldRow label="Email address" error="Please enter a valid email address">
                <input type="email" className="input input-error w-full" defaultValue="invalid@" />
              </FieldRow>
            </div>

            <div className="card bg-base-100 p-8 space-y-6">
              <p className="text-xs text-base-content/40 uppercase tracking-wider">Select & Textarea</p>
              <FieldRow label="Zone">
                <select className="select w-full">
                  <option>Lekki / Ajah</option>
                  <option disabled>Victoria Island (coming soon)</option>
                  <option disabled>Ikeja (coming soon)</option>
                  <option disabled>Surulere (coming soon)</option>
                </select>
              </FieldRow>
              <FieldRow label="Service type">
                <select className="select w-full">
                  <option>Standard Clean</option>
                  <option>Deep Clean</option>
                  <option>Move-in / Move-out</option>
                  <option>Post-construction</option>
                </select>
              </FieldRow>
              <FieldRow label="Special instructions (optional)">
                <textarea
                  className="textarea w-full h-20 resize-none"
                  placeholder="E.g. please focus on the kitchen…"
                />
              </FieldRow>
            </div>

            <div className="card bg-base-100 p-8 space-y-6 md:col-span-2">
              <p className="text-xs text-base-content/40 uppercase tracking-wider">Checkbox & Radio</p>
              <div className="flex flex-wrap gap-12">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-base-content">Add-ons</p>
                  {[
                    { label: "Laundry", price: "+₦3,000", checked: true },
                    { label: "Ironing", price: "+₦2,000", checked: false },
                    { label: "Wardrobe organising", price: "+₦2,500", checked: false },
                  ].map(({ label, price, checked }) => (
                    <label key={label} className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" className="checkbox checkbox-primary" defaultChecked={checked} />
                      <span className="text-sm">
                        {label}{" "}
                        <span className="text-base-content/50">{price}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-base-content">Apartment size</p>
                  {["1 bedroom", "2 bedrooms", "3 bedrooms", "4+ bedrooms"].map((size, i) => (
                    <label key={size} className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" className="radio radio-primary" name="size-demo" defaultChecked={i === 1} />
                      <span className="text-sm">{size}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </Section>

        {/* ── CARDS (raw daisyUI) ─────────────────────── */}
        <Section id="cards" title="Cards (raw daisyUI)">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <h3 className="card-title text-lg">Standard Clean</h3>
                <p className="text-base-content/70 text-sm leading-relaxed">
                  A thorough general clean of all rooms. Ideal for regular upkeep.
                </p>
                <div className="card-actions justify-between items-center mt-4">
                  <span className="font-semibold text-primary text-sm">From ₦18,000</span>
                  <button className="btn btn-primary btn-sm">Select</button>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <div className="flex justify-between items-start">
                  <h3 className="card-title text-lg">Deep Clean</h3>
                  <span className="badge badge-accent badge-sm">Popular</span>
                </div>
                <p className="text-base-content/70 text-sm leading-relaxed">
                  Top-to-bottom including inside appliances, windows, and grout.
                </p>
                <div className="card-actions justify-between items-center mt-4">
                  <span className="font-semibold text-primary text-sm">From ₦32,000</span>
                  <button className="btn btn-primary btn-sm">Select</button>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-sm">
              <div className="card-body items-center text-center gap-3">
                <div className="avatar placeholder">
                  <div className="bg-primary text-primary-content rounded-full w-14">
                    <span className="text-xl">AO</span>
                  </div>
                </div>
                <div>
                  <h3 className="card-title justify-center text-lg">Adaeze</h3>
                  <div className="flex items-center justify-center gap-0.5 text-accent mt-0.5">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                    <span className="text-sm text-base-content/60 ml-1">5.0</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap justify-center">
                  <span className="badge badge-primary badge-outline badge-sm">84 cleans</span>
                  <span className="badge badge-success badge-outline badge-sm">NIN Verified</span>
                </div>
              </div>
            </div>

          </div>
        </Section>

        {/* ── BADGES ─────────────────────────────────── */}
        <Section id="badges" title="Badges">
          <div className="card bg-base-100 p-8 space-y-6">
            <div>
              <p className="text-xs text-base-content/40 uppercase tracking-wider mb-4">Filled</p>
              <div className="flex flex-wrap gap-2">
                {["primary","secondary","accent","neutral","info","success","warning","error"].map((c) => (
                  <span key={c} className={`badge badge-${c} capitalize`}>{c}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-base-content/40 uppercase tracking-wider mb-4">Booking statuses (outline)</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Pending", color: "warning" },
                  { label: "Matched", color: "primary" },
                  { label: "Confirmed", color: "success" },
                  { label: "Completed", color: "neutral" },
                  { label: "No Match", color: "error" },
                  { label: "Cancelled", color: "error" },
                ].map(({ label, color }) => (
                  <span key={label} className={`badge badge-${color} badge-outline`}>{label}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-base-content/40 uppercase tracking-wider mb-4">Sizes</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-primary badge-lg">Large</span>
                <span className="badge badge-primary">Default</span>
                <span className="badge badge-primary badge-sm">Small</span>
                <span className="badge badge-primary badge-xs">X-Small</span>
              </div>
            </div>
          </div>
        </Section>

        {/* ── ALERTS (raw daisyUI) ────────────────────── */}
        <Section id="alerts" title="Alerts (raw daisyUI)">
          <div className="space-y-3">
            <div role="alert" className="alert alert-info alert-soft">
              <svg className="h-4.5 w-4.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>No availability on Dec 25 — <strong>3 nearby dates have open slots.</strong> Choose one below.</span>
            </div>
            <div role="alert" className="alert alert-success alert-soft">
              <svg className="h-4.5 w-4.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Booking confirmed! <strong>Adaeze</strong> arrives Dec 18 between 9:00–9:30 AM.</span>
            </div>
            <div role="alert" className="alert alert-warning alert-soft">
              <svg className="h-4.5 w-4.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Free cancellation available until <strong>Dec 17 at 9:00 AM.</strong></span>
            </div>
            <div role="alert" className="alert alert-error alert-soft">
              <svg className="h-4.5 w-4.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Payment failed. Please check your card details and try again.</span>
            </div>
          </div>
        </Section>

        {/* ── SHADOWS ────────────────────────────────── */}
        <Section id="shadows" title="Shadows & Depth">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "shadow-xs", desc: "Tags, chips, subtle lift", cls: "shadow-xs" },
              { label: "shadow-sm", desc: "Cards, input wrappers", cls: "shadow-sm" },
              { label: "shadow-md", desc: "Dropdowns, modals", cls: "shadow-md" },
            ].map(({ label, desc, cls }) => (
              <div key={label} className="card bg-base-100 p-8">
                <p className="text-xs text-base-content/40 uppercase tracking-wider mb-5">{label}</p>
                <div className={`bg-base-100 rounded-xl p-6 ${cls}`}>
                  <p className="text-sm font-medium text-base-content">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ════════════════════════════════════════════════
            UI PRIMITIVES — components/ui/
            ════════════════════════════════════════════════ */}
        <div className="pt-4">
          <div className="flex items-center gap-4">
            <p className="text-xs tracking-widest uppercase text-primary/60 font-semibold shrink-0">
              components/ui — reusable primitives
            </p>
            <div className="flex-1 h-px bg-primary/20" />
          </div>
          <p className="text-sm text-base-content/50 mt-3 max-w-xl">
            Typed, accessible wrappers over daisyUI. Import these in feature pages — never reach for raw daisyUI classes when one of these fits.
          </p>
        </div>

        {/* ── ui/Button ──────────────────────────────── */}
        <Section id="ui-button" title="Button">
          <div className="space-y-4">

            <Card padded>
              <p className="text-xs text-base-content/40 uppercase tracking-wider mb-5">Variants</p>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary">Book a cleaning</Button>
                <Button variant="secondary">Learn more</Button>
                <Button variant="accent">View offer</Button>
                <Button variant="neutral">Neutral</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="outline">Outline</Button>
              </div>
            </Card>

            <Card padded>
              <p className="text-xs text-base-content/40 uppercase tracking-wider mb-5">Sizes</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg">Large</Button>
                <Button size="md">Default</Button>
                <Button size="sm">Small</Button>
                <Button size="xs">X-Small</Button>
              </div>
            </Card>

            <Card padded>
              <p className="text-xs text-base-content/40 uppercase tracking-wider mb-5">States</p>
              <div className="flex flex-wrap gap-3">
                <Button>Default</Button>
                <Button disabled>Disabled</Button>
                <Button loading>Confirming…</Button>
                <Button wide>Wide / Full CTA</Button>
              </div>
            </Card>

          </div>
        </Section>

        {/* ── ui/FormField ───────────────────────────── */}
        <Section id="ui-formfield" title="FormField & SelectField">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <Card>
              <CardBody className="space-y-5">
                <p className="text-xs text-base-content/40 uppercase tracking-wider">Text · Email · Tel</p>
                <FormField
                  label="Full name"
                  name="demo-name"
                  type="text"
                  placeholder="Adaeze Okonkwo"
                  required
                />
                <FormField
                  label="Phone number"
                  name="demo-phone"
                  type="tel"
                  placeholder="0803 000 0000"
                  hint="We'll send your booking confirmation here"
                />
                <FormField
                  label="Email address"
                  name="demo-email"
                  type="email"
                  defaultValue="invalid@"
                  error="Please enter a valid email address"
                />
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-5">
                <p className="text-xs text-base-content/40 uppercase tracking-wider">Select field</p>
                <SelectField
                  label="Zone"
                  name="demo-zone"
                  required
                  hint="Only Lekki / Ajah is live at launch"
                >
                  <option value="">Select a zone…</option>
                  <option value="lekki">Lekki / Ajah</option>
                  <option value="vi" disabled>Victoria Island (coming soon)</option>
                  <option value="ikeja" disabled>Ikeja (coming soon)</option>
                  <option value="surulere" disabled>Surulere (coming soon)</option>
                </SelectField>
                <SelectField
                  label="Service type"
                  name="demo-service"
                  error="Please select a service to continue"
                >
                  <option value="">Select a service…</option>
                  <option value="standard">Standard Clean</option>
                  <option value="deep">Deep Clean</option>
                  <option value="movein">Move-in / Move-out</option>
                  <option value="postconstruction">Post-construction</option>
                </SelectField>
              </CardBody>
            </Card>

          </div>
        </Section>

        {/* ── ui/Card ────────────────────────────────── */}
        <Section id="ui-card" title="Card">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            <Card shadow="none">
              <CardBody>
                <h3 className="card-title text-base">No shadow</h3>
                <p className="text-sm text-base-content/60 mt-1">
                  Use for nested cards or sections inside a container that already has elevation.
                </p>
                <Label>shadow="none"</Label>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h3 className="card-title text-base">Default — shadow-sm</h3>
                <p className="text-sm text-base-content/60 mt-1">
                  The standard card. Use for most content blocks, booking summaries, and service tiles.
                </p>
                <Label>shadow="sm" (default)</Label>
              </CardBody>
            </Card>

            <Card shadow="md">
              <CardBody>
                <h3 className="card-title text-base">Elevated — shadow-md</h3>
                <p className="text-sm text-base-content/60 mt-1">
                  For floating elements: modals, dropdowns, or a prominently featured card.
                </p>
                <Label>shadow="md"</Label>
              </CardBody>
            </Card>

            <Card className="md:col-span-3">
              <CardBody>
                <h3 className="card-title text-base">With <code className="text-sm font-mono">padded</code> prop</h3>
                <p className="text-sm text-base-content/60 mt-1">
                  Pass <code className="font-mono text-sm">padded</code> to auto-wrap children in a{" "}
                  <code className="font-mono text-sm">card-body</code> div — useful when you have only
                  one content block. Use <code className="font-mono text-sm">CardBody</code> directly
                  when you need multiple independently-padded sections.
                </p>
              </CardBody>
            </Card>

          </div>
        </Section>

        {/* ── ui/Skeleton & Spinner ──────────────────── */}
        <Section id="ui-loading" title="Skeleton & Spinner">
          <div className="space-y-4">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <Card padded className="space-y-5">
                <p className="text-xs text-base-content/40 uppercase tracking-wider">Skeleton blocks</p>
                <div>
                  <p className="text-xs text-base-content/40 mb-2">Single blocks</p>
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-1/2 rounded" />
                    <Skeleton className="h-4 w-full rounded" />
                    <Skeleton className="h-4 w-5/6 rounded" />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-base-content/40 mb-2">SkeletonText (3 lines)</p>
                  <SkeletonText lines={3} />
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-xs text-base-content/40">SkeletonAvatar</p>
                  <SkeletonAvatar size="sm" />
                  <SkeletonAvatar size="md" />
                  <SkeletonAvatar size="lg" />
                </div>
              </Card>

              <div className="space-y-4">
                <Card padded>
                  <p className="text-xs text-base-content/40 uppercase tracking-wider mb-4">SkeletonCard</p>
                  <SkeletonCard />
                </Card>
              </div>

            </div>

            <Card padded>
              <p className="text-xs text-base-content/40 uppercase tracking-wider mb-5">Spinner sizes</p>
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <Spinner size="xs" />
                  <span className="text-xs text-base-content/40">xs</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Spinner size="sm" />
                  <span className="text-xs text-base-content/40">sm</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Spinner size="md" />
                  <span className="text-xs text-base-content/40">md</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Spinner size="lg" />
                  <span className="text-xs text-base-content/40">lg</span>
                </div>
              </div>
            </Card>

          </div>
        </Section>

        {/* ── ui/EmptyState ──────────────────────────── */}
        <Section id="ui-emptystate" title="EmptyState">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* No availability */}
            <Card>
              <EmptyState
                icon={
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                }
                heading="No availability on Dec 25"
                message="No cleaners are available in Lekki / Ajah on this date. Choose a nearby date that has open slots."
                action={{ label: "See available dates", href: "#ui-emptystate" }}
              />
            </Card>

            {/* No bookings yet */}
            <Card>
              <EmptyState
                icon={
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                }
                heading="No bookings yet"
                message="Bookings will appear here once customers start placing orders."
              />
            </Card>

            {/* Minimal — no icon */}
            <Card>
              <EmptyState
                heading="Nothing to show"
                message="Apply different filters or check back later."
                action={{ label: "Clear filters", href: "#ui-emptystate", variant: "ghost" }}
              />
            </Card>

          </div>
        </Section>

        {/* ── ui/Alert ───────────────────────────────── */}
        <Section id="ui-alert" title="Alert">
          <div className="space-y-4">

            <Card padded className="space-y-3">
              <p className="text-xs text-base-content/40 uppercase tracking-wider mb-1">All variants</p>
              <Alert variant="info">
                No availability on Dec 25 —{" "}
                <strong>3 nearby dates have open slots.</strong> Choose one below.
              </Alert>
              <Alert variant="success">
                Booking confirmed! <strong>Adaeze</strong> arrives Dec 18 between 9:00–9:30 AM.
                Check your phone for the SMS confirmation.
              </Alert>
              <Alert variant="warning">
                Free cancellation available until <strong>Dec 17 at 9:00 AM.</strong>{" "}
                A 50% fee applies within 24 hours of the booking.
              </Alert>
              <Alert variant="error">
                Payment failed. Please check your card details and try again, or use a different card.
              </Alert>
            </Card>

            <Card padded>
              <p className="text-xs text-base-content/40 uppercase tracking-wider mb-4">
                Dismissible — <code className="font-mono">onDismiss</code> prop
              </p>
              <AlertDismissDemo />
            </Card>

          </div>
        </Section>

      </div>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="border-t border-base-300 bg-base-100 mt-8">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <span className="text-primary text-lg wordmark">Klova</span>
          <span className="text-xs text-base-content/40">Design System · Internal · v1.0</span>
        </div>
      </footer>

    </div>
  );
}
