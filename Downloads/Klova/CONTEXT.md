# Klova — Project Context

Paste this file at the start of any new Claude session to resume work without losing context.
The full step-by-step build guide is in `claude.md`. This file is the *current state snapshot*.

---

## What Klova Is

On-demand home cleaning for Lagos, Nigeria. Customers book a clean, pay online, get auto-matched to a vetted cleaner, and see who's coming before arrival. V1 launches in Lekki / Ajah only.

**Core differentiator:** NIN-verified, rated cleaners. The customer sees the cleaner's name, photo, star rating, and completed-job count before they arrive. Trust is the whole product.

**Pricing (seeded in DB later):**
- Standard Clean: 1-bed ₦18k, 2-bed ₦22k, 3-bed ₦28k, 4-bed+ ₦35k
- Deep Clean: ₦32k / ₦40k / ₦52k / ₦65k
- Move-in/out: ₦45k / ₦55k / ₦70k / ₦85k
- Post-construction: ₦60k / ₦75k / ₦95k / ₦120k
- Add-ons: Laundry +₦3k, Ironing +₦2k, Wardrobe organising +₦2.5k
- Commission: 22% (env var `COMMISSION_RATE=0.22`)

**Zones:** Lekki/Ajah (live at launch), Victoria Island, Ikeja, Surulere (coming soon).

---

## Tech Stack (fixed — do not change)

| Layer | Choice | Version |
|-------|--------|---------|
| Frontend framework | Next.js App Router | 16.2.9 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS | v4 (`@import "tailwindcss"` in CSS — NO tailwind.config.js) |
| Component layer | daisyUI | v5.5.23 (registered via `@plugin "daisyui"` in globals.css) |
| Package manager | pnpm | v11.7.0 |
| Backend | Node.js + Express + TypeScript | (scaffolded, not yet built) |
| Database | Supabase (Postgres + auth) | — |
| Payments | Paystack | — |
| Notifications | Termii (SMS/WhatsApp) | — |
| Frontend hosting | Vercel | Live: https://klova-nine.vercel.app |
| Backend hosting | Railway | (not yet deployed) |
| Repo | GitHub | https://github.com/ReoXT/klova.git |

**Critical Tailwind v4 note:** There is NO `tailwind.config.js`. All config lives in `web/app/globals.css` via `@import "tailwindcss"` and `@plugin "daisyui"`. Custom theme tokens are in a `[data-theme="klova"]` CSS block using OKLCH colors.

---

## Monorepo Structure

```
Klova/
├── web/                        # Next.js frontend → Vercel
│   ├── app/
│   │   ├── layout.tsx          # Root layout — fonts, data-theme="klova"
│   │   ├── globals.css         # Design system — theme, fonts, overrides
│   │   ├── (site)/             # Route group: public pages with nav+footer
│   │   │   ├── layout.tsx      # Wraps children in SiteNav + SiteFooter
│   │   │   ├── page.tsx        # Home page (placeholder, landing page is Prompt 6.1)
│   │   │   ├── terms/page.tsx
│   │   │   ├── privacy/page.tsx
│   │   │   └── cancellation/page.tsx
│   │   └── styleguide/         # Design system reference (not public-facing)
│   │       ├── page.tsx
│   │       └── _components/AlertDismissDemo.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── SiteNav.tsx     # "use client" — sticky nav, mobile drawer
│   │   │   └── SiteFooter.tsx  # Footer with WhatsApp + legal links
│   │   └── ui/                 # Reusable primitives — always use these, never raw daisyUI
│   │       ├── Button.tsx
│   │       ├── FormField.tsx   # exports FormField + SelectField
│   │       ├── Card.tsx        # exports Card + CardBody
│   │       ├── Skeleton.tsx    # exports Skeleton, SkeletonText, SkeletonCard, SkeletonAvatar, Spinner
│   │       ├── EmptyState.tsx
│   │       └── Alert.tsx
│   ├── pnpm-workspace.yaml     # allowBuilds: sharp + unrs-resolver (required — do not remove)
│   └── package.json
├── api/                        # Express backend → Railway (not yet built)
│   ├── .env.example
│   └── package.json
├── CONTEXT.md                  # This file — update after every session
├── claude.md                   # Full step-by-step build guide (Sections 0–13)
├── .gitignore
└── README.md
```

**Route group rule:** `app/(site)/` = public pages that get SiteNav + SiteFooter. The `/styleguide` page sits outside the group (its own sticky nav). Future `/admin` will get its own route group with a sidebar layout. Never put SiteNav in the root `app/layout.tsx`.

---

## Design System

### Theme

- **Name:** `klova` — set via `data-theme="klova"` on `<html>` in `app/layout.tsx`
- **Color space:** OKLCH throughout

```css
/* Key palette values in web/app/globals.css */
--color-primary:   oklch(0.29 0.09 152);   /* deep forest green */
--color-secondary: oklch(0.92 0.015 78);   /* warm stone */
--color-accent:    oklch(0.68 0.14 67);    /* Lagos amber */
--color-base-100:  oklch(0.99 0.004 85);   /* warm near-white */
--color-base-200:  oklch(0.96 0.01 85);    /* section backgrounds */
```

### Fonts

Loaded in `app/layout.tsx` via `next/font/google`, exposed as CSS variables:

- **`--font-dm-serif`** → DM Serif Display (weight 400) — all headings (h1–h6 get it automatically via globals.css)
- **`--font-plus-jakarta`** → Plus Jakarta Sans (weights 400/500/600/700) — body and UI text
- **`.wordmark`** CSS class — applies DM Serif + letter-spacing to the Klova brand name. Use this class on every instance of the "Klova" wordmark (nav, footer, etc.)

### Radius system

```
--radius-selector: 0.375rem   /* checkboxes, radios */
--radius-field:    0.5rem     /* inputs, selects */
--radius-box:      0.75rem    /* cards, alerts, dropdowns */
```

### Key CSS overrides in globals.css

- `.badge { line-height: 1; padding-bottom: 0.5px; }` — fixes Plus Jakarta Sans vertical centering in badges
- `body { text-rendering: optimizeLegibility; font-optical-sizing: auto; }` — improves font rendering

---

## Component Rules

**Always import from `components/ui/` — never write raw daisyUI classes inline when a component exists.**

| Need | Import |
|------|--------|
| Any button | `Button` from `@/components/ui/Button` |
| Text/email/tel input | `FormField` from `@/components/ui/FormField` |
| Select/dropdown | `SelectField` from `@/components/ui/FormField` |
| Content card | `Card`, `CardBody` from `@/components/ui/Card` |
| Loading placeholder | `SkeletonCard`, `SkeletonText`, `SkeletonAvatar` from `@/components/ui/Skeleton` |
| Spinner | `Spinner` from `@/components/ui/Skeleton` |
| Empty state | `EmptyState` from `@/components/ui/EmptyState` |
| Alert/toast | `Alert` from `@/components/ui/Alert` |

**Alert style:** `alert-soft` — pale tinted background, NOT solid color blocks. This is a deliberate design decision.

**Badges:** Use daisyUI `badge` classes directly (no Badge component needed — the CSS override in globals.css handles alignment).

---

## SiteNav Details

- Sticky, `z-40`, `bg-base-100/95 backdrop-blur-sm`, `h-16`
- Desktop: Klova wordmark left | "Zones we serve" dropdown centre | "Book a cleaning" CTA right
- Mobile: Klova + hamburger → right-side drawer with backdrop + ESC-to-close + body scroll lock
- `"use client"` — uses React `useState` for drawer open/close
- Zones array is hardcoded in `SiteNav.tsx`: Lekki/Ajah active, others `active: false`

## SiteFooter Details

- `bg-base-100`, top border, `mt-auto`
- Left: Klova wordmark + tagline
- Right: WhatsApp support link (`wa.me/2348000000000` — placeholder number, replace before launch)
- Bottom: copyright + legal links (Terms / Privacy / Cancellation & Refunds)

---

## What's Been Completed

| Prompt | Status | Notes |
|--------|--------|-------|
| 0.1 Tooling setup | ✅ Done | Node, pnpm, Vercel CLI, Railway CLI, Supabase CLI, git config |
| 0.2 Monorepo | ✅ Done | `/web` + `/api`, .gitignore, README, .env.example files |
| 1.1 Next.js scaffold | ✅ Done | App Router, TypeScript, Tailwind v4, daisyUI v5, deployed to Vercel |
| 1.2 Design system | ✅ Done | Custom "klova" theme, DM Serif + Plus Jakarta Sans, styleguide at /styleguide |
| 1.3 Shared layout | ✅ Done | SiteNav (mobile drawer), SiteFooter, (site) route group, stub legal pages |
| 1.4 UI primitives | ✅ Done | Button, FormField, SelectField, Card, Skeleton, EmptyState, Alert — all in styleguide |

**Next prompt to run: Prompt 2.1 — Express server scaffold & health check**

---

## Environment Variables

### web/.env.example
```
NEXT_PUBLIC_API_URL=    # URL of the Express backend
```

### api/.env.example
```
PORT=4000
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # NEVER send to frontend or commit
PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=
PAYSTACK_WEBHOOK_SECRET=
TERMII_API_KEY=
TERMII_SENDER_ID=
COMMISSION_RATE=0.22
FRONTEND_ORIGIN=             # CORS allowed origin
```

---

## Commands

```bash
# Run frontend locally (port 3000)
cd web && pnpm dev

# Run backend locally (port 4000)
cd api && pnpm dev

# Build frontend
cd web && pnpm build

# Install deps (from web/ or api/)
pnpm install
```

**pnpm note:** `web/pnpm-workspace.yaml` has `allowBuilds: { sharp: true, unrs-resolver: true }`. Do not remove this or pnpm install will fail.

---

## Security Rules (never break these)

1. `.env` files are never committed — only `.env.example` with blank values
2. `SUPABASE_SERVICE_ROLE_KEY` is server-only — never in frontend code or git
3. All pricing is computed server-side — never trust a price sent from the browser
4. The Paystack webhook is the ONLY trusted source for confirming payment — never the frontend redirect
5. The frontend never talks to Supabase directly — all data goes through the Express API
6. Admin routes must be behind Supabase auth — never accessible to customers

---

## Git

- Branch: `main`
- Remote: `https://github.com/ReoXT/klova.git`
- Vercel auto-deploys on push to `main`
- Commit style: `feat(web):`, `fix(web):`, `refactor(web):`, `feat(api):` etc.
