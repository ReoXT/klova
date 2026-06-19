import type { Metadata } from "next";
import Link from "next/link";

import { Button }       from "@/components/ui/Button";
import { FormField, SelectField } from "@/components/ui/FormField";
import { Card, CardBody } from "@/components/ui/Card";
import { SkeletonText, SkeletonCard, SkeletonAvatar, Spinner } from "@/components/ui/Skeleton";
import { EmptyState }   from "@/components/ui/EmptyState";
import { Alert }        from "@/components/ui/Alert";
import { AlertDismissDemo } from "./_components/AlertDismissDemo";
import { KeeperCard }      from "@/components/ui/KeeperCard";

export const metadata: Metadata = { title: "Design System — Klova" };

/* ── Internal helpers ─────────────────────────────────────── */

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-5">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl text-base-content shrink-0">{title}</h2>
        <div className="flex-1 h-px bg-base-300" />
      </div>
      {children}
    </section>
  );
}

function Swatch({ name, bg, border = "", label }: { name: string; bg: string; border?: string; label: string }) {
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

function Tag({ children }: { children: string }) {
  return (
    <code className="text-xs font-mono bg-base-200 text-base-content/60 px-1.5 py-0.5 rounded-md">
      {children}
    </code>
  );
}

function Sub({ children }: { children: string }) {
  return <p className="text-xs text-base-content/40 uppercase tracking-wider mb-4">{children}</p>;
}

/* ── Page ─────────────────────────────────────────────────── */

const NAV_LINKS = [
  { id: "colors",      label: "Colors" },
  { id: "typography",  label: "Type" },
  { id: "buttons",     label: "Buttons" },
  { id: "forms",       label: "Forms" },
  { id: "cards",       label: "Cards" },
  { id: "badges",      label: "Badges" },
  { id: "alerts",      label: "Alerts" },
  { id: "loading",     label: "Loading" },
  { id: "empty-state", label: "Empty" },
  { id: "shadows",     label: "Shadows" },
  { id: "keeper-card", label: "Keeper" },
];

export default function StyleGuidePage() {
  return (
    <div className="min-h-screen bg-base-200">

      {/* ── Sticky nav ──────────────────────────────────── */}
      <nav className="sticky top-0 z-10 bg-base-100/90 backdrop-blur-sm border-b border-base-300">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="wordmark text-xl text-primary">Klova</Link>
            <span className="text-base-content/30 select-none">/</span>
            <span className="text-sm text-base-content/50">Design System</span>
          </div>
          <div className="hidden sm:flex items-center gap-5 text-xs text-base-content/50">
            {NAV_LINKS.map(({ id, label }) => (
              <a key={id} href={`#${id}`} className="hover:text-primary whitespace-nowrap transition-colors duration-150">
                {label}
              </a>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────── */}
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

      {/* ── Content ─────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-16 space-y-20">

        {/* COLORS ─────────────────────────────────────── */}
        <Section id="colors" title="Colors">
          <p className="text-sm text-base-content/60 -mt-1">
            Warm palette built for trust. Forest green anchors the brand; stone and amber add warmth.
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Swatch name="Primary"   bg="bg-primary"   label="--color-primary" />
              <Swatch name="Secondary" bg="bg-secondary" label="--color-secondary" />
              <Swatch name="Accent"    bg="bg-accent"    label="--color-accent" />
              <Swatch name="Neutral"   bg="bg-neutral"   label="--color-neutral" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Swatch name="Base 100"     bg="bg-base-100"     border="border border-base-300" label="--color-base-100" />
              <Swatch name="Base 200"     bg="bg-base-200"     label="--color-base-200" />
              <Swatch name="Base 300"     bg="bg-base-300"     label="--color-base-300" />
              <Swatch name="Base Content" bg="bg-base-content" label="--color-base-content" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Swatch name="Info"    bg="bg-info"    label="--color-info" />
              <Swatch name="Success" bg="bg-success" label="--color-success" />
              <Swatch name="Warning" bg="bg-warning" label="--color-warning" />
              <Swatch name="Error"   bg="bg-error"   label="--color-error" />
            </div>
          </div>
        </Section>

        {/* TYPOGRAPHY ─────────────────────────────────── */}
        <Section id="typography" title="Typography">
          <div className="space-y-4">
            <Card padded className="space-y-6">
              <div className="flex items-center gap-3">
                <Tag>DM Serif Display</Tag>
                <span className="text-xs text-base-content/40">Headings only</span>
              </div>
              {[
                { size: "text-5xl", sample: "On-demand cleaning, done right." },
                { size: "text-4xl", sample: "Vetted, rated, and trusted cleaners." },
                { size: "text-3xl", sample: "Your home, professionally cleaned." },
                { size: "text-2xl", sample: "Standard Clean · 2-bedroom" },
                { size: "text-xl",  sample: "Lekki / Ajah · Victoria Island" },
              ].map(({ size, sample }) => (
                <div key={size}>
                  <Tag>{size}</Tag>
                  <p className={`${size} text-base-content mt-2 leading-tight`}>{sample}</p>
                </div>
              ))}
            </Card>

            <Card padded className="space-y-6">
              <div className="flex items-center gap-3">
                <Tag>Plus Jakarta Sans</Tag>
                <span className="text-xs text-base-content/40">Body & UI</span>
              </div>
              {[
                { cls: "text-lg font-semibold", sample: "Adaeze will arrive between 9:00 – 9:30 AM on Friday." },
                { cls: "text-base leading-relaxed", sample: "All our cleaners are thoroughly vetted, background-checked, and rated by real customers. You'll see exactly who's coming before they arrive." },
                { cls: "text-sm text-base-content/70", sample: "Booking ref: KL-2024-00142 · Paid ₦24,000 · Dec 18, 2024 · Standard Clean" },
                { cls: "text-xs text-base-content/50 uppercase tracking-wider", sample: "Service type · Standard clean · Lekki/Ajah zone" },
              ].map(({ cls, sample }) => (
                <div key={cls}>
                  <Tag>{cls.split(" ")[0]}</Tag>
                  <p className={`${cls} text-base-content mt-2`}>{sample}</p>
                </div>
              ))}
            </Card>
          </div>
        </Section>

        {/* BUTTONS ────────────────────────────────────── */}
        <Section id="buttons" title="Buttons">
          <div className="space-y-4">
            <Card padded>
              <Sub>Variants</Sub>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary">Book a cleaning</Button>
                <Button variant="secondary">Learn more</Button>
                <Button variant="accent">View offer</Button>
                <Button variant="neutral">Neutral</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="outline">Outline</Button>
              </div>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card padded>
                <Sub>Sizes</Sub>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="lg">Large</Button>
                  <Button size="md">Default</Button>
                  <Button size="sm">Small</Button>
                  <Button size="xs">X-Small</Button>
                </div>
              </Card>
              <Card padded>
                <Sub>States</Sub>
                <div className="flex flex-wrap gap-3">
                  <Button>Default</Button>
                  <Button disabled>Disabled</Button>
                  <Button loading>Confirming…</Button>
                  <Button wide>Wide CTA</Button>
                </div>
              </Card>
            </div>
          </div>
        </Section>

        {/* FORMS ──────────────────────────────────────── */}
        <Section id="forms" title="Forms">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <Card>
              <CardBody className="space-y-5">
                <Sub>Text · Email · Tel</Sub>
                <FormField label="Full name"     name="demo-name"  type="text" placeholder="Adaeze Okonkwo" required />
                <FormField label="Phone number"  name="demo-phone" type="tel"  placeholder="0803 000 0000" hint="We'll send your confirmation here" />
                <FormField label="Email address" name="demo-email" type="email" defaultValue="invalid@" error="Please enter a valid email address" />
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-5">
                <Sub>Select</Sub>
                <SelectField label="Zone" name="demo-zone" required hint="Only Lekki / Ajah is live at launch">
                  <option value="">Select a zone…</option>
                  <option value="lekki">Lekki / Ajah</option>
                  <option value="vi"        disabled>Victoria Island (coming soon)</option>
                  <option value="ikeja"     disabled>Ikeja (coming soon)</option>
                  <option value="surulere"  disabled>Surulere (coming soon)</option>
                </SelectField>
                <SelectField label="Service type" name="demo-service" error="Please select a service to continue">
                  <option value="">Select a service…</option>
                  <option value="standard">Standard Clean</option>
                  <option value="deep">Deep Clean</option>
                  <option value="movein">Move-in / Move-out</option>
                  <option value="post">Post-construction</option>
                </SelectField>
              </CardBody>
            </Card>

            <Card className="md:col-span-2">
              <CardBody>
                <Sub>Checkbox & Radio</Sub>
                <div className="flex flex-wrap gap-12">
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Add-ons</p>
                    {[
                      { label: "Laundry",             price: "+₦3,000", checked: true },
                      { label: "Ironing",             price: "+₦2,000", checked: false },
                      { label: "Wardrobe organising", price: "+₦2,500", checked: false },
                    ].map(({ label, price, checked }) => (
                      <label key={label} className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" className="checkbox checkbox-primary" defaultChecked={checked} />
                        <span className="text-sm">{label} <span className="text-base-content/50">{price}</span></span>
                      </label>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Apartment size</p>
                    {["1 bedroom", "2 bedrooms", "3 bedrooms", "4+ bedrooms"].map((size, i) => (
                      <label key={size} className="flex items-center gap-3 cursor-pointer">
                        <input type="radio" className="radio radio-primary" name="size-demo" defaultChecked={i === 1} />
                        <span className="text-sm">{size}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>

          </div>
        </Section>

        {/* CARDS ──────────────────────────────────────── */}
        <Section id="cards" title="Cards">
          <div className="space-y-4">

            {/* Shadow variants */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card shadow="none">
                <CardBody>
                  <h3 className="card-title text-base">No shadow</h3>
                  <p className="text-sm text-base-content/60 mt-1">Nested or inside an already-elevated container.</p>
                  <Tag>shadow="none"</Tag>
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <h3 className="card-title text-base">Default</h3>
                  <p className="text-sm text-base-content/60 mt-1">Most content blocks, booking summaries, service tiles.</p>
                  <Tag>shadow="sm"</Tag>
                </CardBody>
              </Card>
              <Card shadow="md">
                <CardBody>
                  <h3 className="card-title text-base">Elevated</h3>
                  <p className="text-sm text-base-content/60 mt-1">Modals, dropdowns, prominently featured cards.</p>
                  <Tag>shadow="md"</Tag>
                </CardBody>
              </Card>
            </div>

            {/* Real-world examples */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Service card */}
              <Card>
                <CardBody>
                  <h3 className="card-title text-lg">Standard Clean</h3>
                  <p className="text-base-content/70 text-sm leading-relaxed mt-1">
                    A thorough general clean of all rooms. Ideal for regular upkeep.
                  </p>
                  <div className="card-actions justify-between items-center mt-4">
                    <span className="font-semibold text-primary text-sm">From ₦18,000</span>
                    <Button size="sm">Select</Button>
                  </div>
                </CardBody>
              </Card>

              {/* Service card with badge */}
              <Card>
                <CardBody>
                  <div className="flex justify-between items-start">
                    <h3 className="card-title text-lg">Deep Clean</h3>
                    <span className="badge badge-accent badge-sm">Popular</span>
                  </div>
                  <p className="text-base-content/70 text-sm leading-relaxed mt-1">
                    Top-to-bottom including inside appliances, windows, and grout.
                  </p>
                  <div className="card-actions justify-between items-center mt-4">
                    <span className="font-semibold text-primary text-sm">From ₦32,000</span>
                    <Button size="sm">Select</Button>
                  </div>
                </CardBody>
              </Card>

              {/* Cleaner profile card */}
              <Card>
                <CardBody className="items-center text-center gap-3">
                  <div className="avatar placeholder">
                    <div className="bg-primary text-primary-content rounded-full w-14">
                      <span className="text-xl">AO</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="card-title justify-center text-lg">Adaeze</h3>
                    <div className="flex items-center justify-center gap-0.5 text-accent mt-1">
                      {[...Array(5)].map((_, i) => (
                        <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20" aria-hidden="true">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                      <span className="text-sm text-base-content/60 ml-1">5.0</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-center">
                    <span className="badge badge-primary badge-outline badge-sm">84 cleans</span>
                    <span className="badge badge-success badge-outline badge-sm">✓ Verified</span>
                  </div>
                </CardBody>
              </Card>

            </div>
          </div>
        </Section>

        {/* BADGES ─────────────────────────────────────── */}
        <Section id="badges" title="Badges">
          <Card padded className="space-y-6">
            <div>
              <Sub>Brand & status</Sub>
              <div className="flex flex-wrap gap-2">
                {["primary","secondary","accent","neutral","info","success","warning","error"].map((c) => (
                  <span key={c} className={`badge badge-${c} capitalize`}>{c}</span>
                ))}
              </div>
            </div>
            <div>
              <Sub>Booking statuses (outline)</Sub>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Pending",   color: "warning" },
                  { label: "Matched",   color: "primary" },
                  { label: "Confirmed", color: "success" },
                  { label: "Completed", color: "neutral" },
                  { label: "No Match",  color: "error" },
                  { label: "Cancelled", color: "error" },
                ].map(({ label, color }) => (
                  <span key={label} className={`badge badge-${color} badge-outline`}>{label}</span>
                ))}
              </div>
            </div>
            <div>
              <Sub>Sizes</Sub>
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-primary badge-lg">Large</span>
                <span className="badge badge-primary">Default</span>
                <span className="badge badge-primary badge-sm">Small</span>
                <span className="badge badge-primary badge-xs">X-Small</span>
              </div>
            </div>
          </Card>
        </Section>

        {/* ALERTS ─────────────────────────────────────── */}
        <Section id="alerts" title="Alerts">
          <div className="space-y-4">
            <Card padded className="space-y-3">
              <Sub>All variants</Sub>
              <Alert variant="info">No availability on Dec 25 — <strong>3 nearby dates have open slots.</strong> Choose one below.</Alert>
              <Alert variant="success">Booking confirmed! <strong>Adaeze</strong> arrives Dec 18 between 9:00–9:30 AM. Check your phone for the SMS.</Alert>
              <Alert variant="warning">Free cancellation available until <strong>Dec 17 at 9:00 AM.</strong> A 50% fee applies after that.</Alert>
              <Alert variant="error">Payment failed. Please check your card details and try again.</Alert>
            </Card>
            <Card padded>
              <Sub>Dismissible</Sub>
              <AlertDismissDemo />
            </Card>
          </div>
        </Section>

        {/* LOADING ────────────────────────────────────── */}
        <Section id="loading" title="Loading">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card padded className="space-y-5">
              <Sub>Skeleton blocks</Sub>
              <SkeletonText lines={3} />
              <div className="flex items-center gap-3 pt-1">
                <SkeletonAvatar size="sm" />
                <SkeletonAvatar size="md" />
                <SkeletonAvatar size="lg" />
              </div>
            </Card>
            <Card padded>
              <Sub>Skeleton card</Sub>
              <SkeletonCard />
            </Card>
            <Card padded className="md:col-span-2">
              <Sub>Spinner sizes</Sub>
              <div className="flex items-center gap-8">
                {(["xs","sm","md","lg"] as const).map((s) => (
                  <div key={s} className="flex flex-col items-center gap-2">
                    <Spinner size={s} />
                    <span className="text-xs text-base-content/40">{s}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </Section>

        {/* EMPTY STATE ────────────────────────────────── */}
        <Section id="empty-state" title="Empty State">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <EmptyState
                icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>}
                heading="No availability on Dec 25"
                message="No cleaners are free in Lekki / Ajah on this date. Choose a nearby date."
                action={{ label: "See available dates", href: "#empty-state" }}
              />
            </Card>
            <Card>
              <EmptyState
                icon={<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
                heading="No bookings yet"
                message="Bookings will appear here once customers start placing orders."
              />
            </Card>
            <Card>
              <EmptyState
                heading="Nothing to show"
                message="Apply different filters or check back later."
                action={{ label: "Clear filters", href: "#empty-state", variant: "ghost" }}
              />
            </Card>
          </div>
        </Section>

        {/* SHADOWS ────────────────────────────────────── */}
        <Section id="shadows" title="Shadows & Radius">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "shadow-xs", desc: "Tags, chips", cls: "shadow-xs" },
              { label: "shadow-sm", desc: "Cards, inputs", cls: "shadow-sm" },
              { label: "shadow-md", desc: "Dropdowns, modals", cls: "shadow-md" },
            ].map(({ label, desc, cls }) => (
              <Card key={label} padded>
                <Tag>{label}</Tag>
                <div className={`bg-base-100 rounded-xl p-5 mt-4 ${cls}`}>
                  <p className="text-sm font-medium">{desc}</p>
                </div>
              </Card>
            ))}
          </div>
          <Card padded>
            <Sub>Border radius</Sub>
            <div className="flex flex-wrap gap-8 items-end">
              {[
                { label: "--radius-selector", value: "6px",  cls: "rounded-[6px]",  w: "w-12 h-12" },
                { label: "--radius-field",    value: "8px",  cls: "rounded-[8px]",  w: "w-16 h-12" },
                { label: "--radius-box",      value: "12px", cls: "rounded-[12px]", w: "w-20 h-16" },
                { label: "rounded-full",      value: "pill", cls: "rounded-full",   w: "w-16 h-10" },
              ].map(({ label, value, cls, w }) => (
                <div key={label} className="flex flex-col items-center gap-2">
                  <div className={`${w} ${cls} bg-primary/10 border-2 border-primary/30`} />
                  <code className="text-xs text-base-content/50">{value}</code>
                  <span className="text-xs text-base-content/40 text-center max-w-20">{label}</span>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        {/* KEEPER CARD ────────────────────────────────── */}
        <Section id="keeper-card" title="Keeper Card">
          <p className="text-sm text-base-content/60 -mt-1">
            Shown to the customer once a cleaner is matched — the trust moment before payment.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl">
            {/* Established keeper — no photo yet */}
            <div className="space-y-2">
              <Sub>Established keeper</Sub>
              <KeeperCard firstName="Chidi" rating={4.8} totalJobs={187} />
            </div>
            {/* Newer keeper */}
            <div className="space-y-2">
              <Sub>Newer keeper</Sub>
              <KeeperCard firstName="Amara" rating={4.6} totalJobs={9} />
            </div>
            {/* New keeper — graceful empty state */}
            <div className="space-y-2">
              <Sub>New keeper</Sub>
              <KeeperCard firstName="Seun" />
            </div>
          </div>
        </Section>

      </div>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-base-300 bg-base-100 mt-8">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <span className="wordmark text-xl text-primary">Klova</span>
          <span className="text-xs text-base-content/40">Design System · Internal · v1.0</span>
        </div>
      </footer>

    </div>
  );
}
