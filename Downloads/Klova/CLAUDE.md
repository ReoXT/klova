# Klova — Project Context

Paste this file at the start of any new Claude session to resume work without losing context.
The full step-by-step build guide is in `Klova Prompts.md`. The master schema, pricing, and matching logic are in `MASTER-ROADMAP.md`.

---

## What Klova Is

On-demand home cleaning for Lagos, Nigeria. Customers book a clean, pay online, get auto-matched to a vetted cleaner, and see who's coming before arrival. V1 launches in Lekki / Ajah only.

**Core differentiator:** NIN-verified, rated cleaners. The customer sees the cleaner's name, photo, star rating, and completed-job count before they arrive. Trust is the whole product.

**Pricing (live in DB — from MASTER-ROADMAP.md Section 9):**

| Service | 1-bed | 2-bed | 3-bed | 4-bed+ |
|---|---|---|---|---|
| Standard Clean | ₦5,000 | ₦9,500 | ₦14,000 | ₦18,000 |
| Deep Clean | ₦18,500 | ₦30,000 | ₦44,000 | ₦65,000 |
| Move-in / Move-out | ₦40,000 | ₦56,000 | ₦74,000 | ₦90,000 |
| Post-construction | ₦45,000 | ₦66,000 | ₦88,000 | ₦110,000 |

**Add-ons:** Laundry ₦3,500 · Ironing ₦4,600 · Wardrobe organising ₦4,000

**Commission:** 22% (env var `COMMISSION_RATE=0.22`)

**Zones:** Lekki/Ajah (live), Victoria Island / Ikeja / Surulere (coming soon — `is_active = false`).

---

## Tech Stack (fixed — do not change)

| Layer | Choice | Version |
|-------|--------|---------|
| Frontend framework | Next.js App Router | 16.2.9 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS | v4 (`@import "tailwindcss"` in CSS — NO tailwind.config.js) |
| Component layer | daisyUI | v5.5.23 (registered via `@plugin "daisyui"` in globals.css) |
| Package manager | pnpm | v11.7.0 |
| Backend | Node.js + Express + TypeScript | live on Railway |
| Database | Supabase (Postgres + auth) | schema applied, RLS on |
| Payments | Paystack | — |
| Notifications | Termii (SMS/WhatsApp) | — |
| Frontend hosting | Vercel | Live: https://klova-nine.vercel.app |
| Backend hosting | Railway | Live: https://klova-production.up.railway.app |
| Test runner | Vitest | v2.1.9 (in api/ only) |
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
│   ├── components/
│   │   ├── layout/
│   │   │   ├── SiteNav.tsx     # "use client" — sticky nav, mobile drawer
│   │   │   └── SiteFooter.tsx  # Footer with WhatsApp + legal links
│   │   └── ui/                 # Reusable primitives — always use these
│   │       ├── Button.tsx
│   │       ├── FormField.tsx   # exports FormField + SelectField
│   │       ├── Card.tsx        # exports Card + CardBody
│   │       ├── Skeleton.tsx    # exports Skeleton, SkeletonText, SkeletonCard, SkeletonAvatar, Spinner
│   │       ├── EmptyState.tsx
│   │       └── Alert.tsx
│   ├── pnpm-workspace.yaml     # allowBuilds: sharp + unrs-resolver (required — do not remove)
│   └── package.json
├── api/                        # Express backend → Railway
│   ├── src/
│   │   ├── __tests__/
│   │   │   ├── pricingService.test.ts   # 5 tests
│   │   │   └── bookingService.test.ts   # 12 tests
│   │   ├── controllers/
│   │   │   ├── healthController.ts
│   │   │   ├── pricingController.ts
│   │   │   └── bookingController.ts
│   │   ├── lib/
│   │   │   └── supabase.ts              # service-role client (bypasses RLS)
│   │   ├── middleware/
│   │   │   ├── errorHandler.ts          # returns { error: { message, fields?, stack? } }
│   │   │   └── requestLogger.ts
│   │   ├── routes/
│   │   │   ├── health.ts
│   │   │   ├── pricing.ts
│   │   │   └── bookings.ts
│   │   ├── services/
│   │   │   ├── pricingService.ts        # computePrice(), getPricingGrid()
│   │   │   └── bookingService.ts        # validateBookingInput(), createBooking()
│   │   ├── app.ts
│   │   ├── config.ts
│   │   └── server.ts
│   ├── pnpm-workspace.yaml     # allowBuilds: esbuild (needed for vitest)
│   └── package.json
├── supabase/
│   └── migrations/
│       ├── 20260617000001_schema.sql    # all 10 tables
│       ├── 20260617000002_seed.sql      # zones, services, pricing, addons
│       └── 20260617000003_rls.sql       # RLS enabled, no permissive policies
├── CLAUDE.md                   # This file — update after every session
├── MASTER-ROADMAP.md           # Schema, matching algorithm, pricing (source of truth)
├── Klova Prompts.md            # Step-by-step build prompts (Sections 0–13)
├── .gitignore
└── README.md
```

---

## Database Schema

All tables are in the `public` schema. RLS is **enabled on all 10 tables** with no permissive policies — the anon key has zero access. The Express backend uses the service role key, which bypasses RLS.

### Tables

| Table | Key columns | Notes |
|---|---|---|
| `zones` | id (uuid), name, slug, is_active | 4 rows seeded |
| `services` | id (uuid), name, slug, description | 4 rows seeded |
| `pricing` | id, service_id→services, bedrooms ('1'/'2'/'3'/'4+'), amount_kobo | 16 rows seeded |
| `addons` | id, name, slug, amount_kobo | 3 rows seeded |
| `cleaners` | id, first_name, last_name, phone (unique), photo_url, zone_id→zones, status ('active'/'inactive'/'suspended'), nin_verified, rating (1–5), total_jobs | — |
| `cleaner_availability` | id, cleaner_id→cleaners, available_date (date), is_booked | UNIQUE (cleaner_id, available_date) |
| `customers` | id, first_name, last_name, phone (unique), email | upserted on phone at booking time |
| `bookings` | id, customer_id, cleaner_id (null until matched), requested_cleaner_id, zone_id, service_id, bedrooms, booking_date, address, total_amount_kobo, commission_kobo, status, paystack_reference, refunded_at, created_at, updated_at | updated_at trigger; status enum via CHECK |
| `booking_addons` | id, booking_id→bookings, addon_id→addons | UNIQUE (booking_id, addon_id) |
| `ratings` | id, booking_id (unique)→bookings, customer_id, cleaner_id, score (1–5 CHECK), comment | — |

**Booking statuses:** `pending_payment` → `paid` → `matched` → `confirmed` → `completed` / `cancelled` / `no_match`

**Amounts:** all stored as integers in **kobo** (1 NGN = 100 kobo). API responses return NGN.

**recent_jobs** is NOT a stored column — computed at match time as `COUNT(*) of bookings WHERE cleaner_id = x AND booking_date >= CURRENT_DATE - INTERVAL '7 days'`.

---

## API Endpoints

Base URL (production): `https://klova-production.up.railway.app`

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Returns `{ ok: true }` |
| GET | `/pricing` | Full pricing grid + add-on list for the frontend calculator |
| POST | `/bookings` | Creates a pending booking, returns `booking_id` + server-computed total |

### POST /bookings

**Request body:**
```json
{
  "first_name": "Amara",
  "last_name": "Obi",
  "phone": "08012345678",
  "email": "amara@example.com",
  "address": "14 Admiralty Way, Lekki Phase 1",
  "zone_slug": "lekki-ajah",
  "service_slug": "standard",
  "bedrooms": "2",
  "addon_slugs": ["laundry"],
  "booking_date": "2026-07-01",
  "requested_cleaner_id": null
}
```

**Success (201):**
```json
{ "ok": true, "data": { "booking_id": "uuid", "total_amount": 13000, "commission_amount": 2860, "commission_rate": 0.22 } }
```

**Validation error (400):**
```json
{ "error": { "message": "Validation failed", "fields": { "phone": "phone is required.", "booking_date": "Booking date cannot be in the past." } } }
```

**Validation rules:** all required fields present, zone slug must be active, date not in the past (YYYY-MM-DD), service/bedrooms/addons valid per DB. Price is always recomputed server-side — any price from the browser is ignored.

---

## Key Service Functions

### `pricingService.ts`
- `computePrice(serviceSlug, bedrooms, addonSlugs[])` → `PriceBreakdown` — server-side source of truth. Returns `service_id`, `addon_ids`, `base_amount`, `addons_amount`, `total_amount`, `commission_amount`, `commission_rate` (all NGN). Throws `ValidationError` (400) for unknown service, invalid bedrooms, unknown add-ons.
- `getPricingGrid()` → `PricingGrid` — all services with price grids + all add-ons.

### `matchingService.ts`
- `matchCleaner(booking)` → `string[] | 'NO_MATCH'` — pure selection, no DB writes. Returns ALL candidates in priority order: [P1 requested?, ...P2 preferred sorted, ...P3 rest sorted]. The full list is passed to `assignCleaner()` so Postgres can try fallbacks. Exports `NO_MATCH` const, `MatchResult` type, `BookingForMatch` interface.

### `assignmentService.ts`
- `assignCleaner(bookingId, booking)` → `'matched' | 'no_match'` — calls `matchCleaner()` then invokes the `assign_cleaner` Postgres RPC with the ranked list. The RPC handles all DB writes (is_booked flip, booking status update) inside a single transaction with `SELECT FOR UPDATE` locking.

### `bookingService.ts`
- `validateBookingInput(body)` → `BookingInput` — pure sync, no DB. Collects ALL field errors before throwing `FieldValidationError`.
- `createBooking(input)` → `BookingResult` — validates zone active, calls `computePrice`, upserts customer on phone, inserts booking at `status: 'pending_payment'`, links `booking_addons`. No cleaner assigned yet, no payment yet.

### Error classes
- `ValidationError` — status 400, from pricingService (single message string)
- `FieldValidationError` — status 400, from bookingService (has `.fields: Record<string, string>`)

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

**Alert style:** `alert-soft` — pale tinted background, NOT solid color blocks.

**Badges:** Use daisyUI `badge` classes directly (no Badge component needed).

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
| 2.1 Express scaffold | ✅ Done | Health endpoint live at https://klova-production.up.railway.app/health |
| 2.2 Supabase connection | ✅ Done | Service client in api/src/lib/supabase.ts, round-trip verified in production |
| 2.3 Schema + seed | ✅ Done | 10 tables, 3 migration files, pricing/zones/services/addons seeded |
| 2.4 Row-level security | ✅ Done | RLS on all tables, zero anon access, service role bypasses |
| 3.1 Pricing service | ✅ Done | computePrice(), GET /pricing, 5 passing tests |
| 3.2 Booking creation | ✅ Done | POST /bookings, field-level validation, 17 passing tests total |
| 3.3 Matching algorithm | ✅ Done | matchCleaner() in matchingService.ts, returns ranked string[] for fallback |
| 3.4 Concurrency-safe assignment | ✅ Done | assignCleaner() + assign_cleaner Postgres fn (SELECT FOR UPDATE), 30 tests |

**Next prompt to run: Prompt 3.5 — Paystack webhook (payment confirmation triggers assignment)**

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

# Run backend tests
cd api && pnpm test

# Build frontend
cd web && pnpm build

# Install deps
cd web && pnpm install   # or cd api && pnpm install
```

**pnpm notes:**
- `web/pnpm-workspace.yaml` has `allowBuilds: { sharp: true, unrs-resolver: true }` — do not remove
- `api/pnpm-workspace.yaml` has `allowBuilds: { esbuild: true }` — needed for vitest, do not remove

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
- Commit style: `feat(web):`, `fix(web):`, `refactor(web):`, `feat(api):`, `feat(db):` etc.
