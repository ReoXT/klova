# Klova — Project Context

Paste this file at the start of any new Claude session to resume work without losing context.
The full step-by-step build guide is in `Klova Prompts.md`. The master schema, pricing, and matching logic are in `MASTER-ROADMAP.md`.

---

## What Klova Is

On-demand home cleaning for Lagos, Nigeria. Customers book a clean, get assigned a vetted cleaner instantly, see who's coming (name, photo, rating), then pay. V1 launches in Lekki / Ajah only.

**Core differentiator:** NIN-verified, rated cleaners. The customer sees the cleaner's name, photo, star rating, and completed-job count before they pay. Trust is the whole product.

**The confirmed booking flow:**
1. Customer fills in booking details (service, date, address)
2. Backend assigns the best available cleaner immediately
3. Customer sees cleaner profile (name, photo, rating, job count) → proceeds to pay
4. Paystack webhook confirms payment → booking flips to `confirmed` → cleaner gets notified

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
| Payments | Paystack | test keys active |
| Notifications | Termii (SMS/WhatsApp) | stubs only — Section 5 |
| Frontend hosting | Vercel | Live: https://klova-nine.vercel.app |
| Backend hosting | Railway | Live: https://klova-production.up.railway.app |
| Test runner | Vitest | v2.1.9 (in api/ only) |
| Repo | GitHub | https://github.com/ReoXT/klova.git |

**Critical Tailwind v4 note:** There is NO `tailwind.config.js`. All config lives in `web/app/globals.css` via `@import "tailwindcss"` and `@plugin "daisyui"`. Custom theme tokens are in a `[data-theme="klova"]` CSS block using OKLCH colors.

**Git repo root is `/Users/reoxt` (home dir), NOT `/Users/reoxt/Downloads/Klova`.** Railway root directory must be set to `Downloads/Klova/api` — this is already configured correctly.

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
│   ├── pnpm-workspace.yaml     # packages: ['.'], allowBuilds: sharp + unrs-resolver
│   └── package.json
├── api/                        # Express backend → Railway
│   ├── src/
│   │   ├── __tests__/
│   │   │   ├── pricingService.test.ts       # 5 tests
│   │   │   ├── bookingService.test.ts       # 12 tests
│   │   │   ├── matchingService.test.ts      # 9 tests
│   │   │   ├── assignmentService.test.ts    # 4 tests
│   │   │   ├── availabilityService.test.ts  # 6 tests
│   │   │   └── refundService.test.ts        # 5 tests  (41 total)
│   │   ├── controllers/
│   │   │   ├── healthController.ts
│   │   │   ├── pricingController.ts
│   │   │   ├── bookingController.ts
│   │   │   ├── availabilityController.ts    # GET /availability/alternatives
│   │   │   ├── paymentController.ts         # POST /payments/initiate
│   │   │   └── webhookController.ts         # POST /webhooks/paystack
│   │   ├── lib/
│   │   │   └── supabase.ts                  # service-role client (bypasses RLS)
│   │   ├── middleware/
│   │   │   ├── errorHandler.ts              # returns { error: { message, fields?, stack? } }
│   │   │   └── requestLogger.ts
│   │   ├── routes/
│   │   │   ├── health.ts
│   │   │   ├── pricing.ts
│   │   │   ├── bookings.ts
│   │   │   ├── availability.ts              # GET /alternatives
│   │   │   ├── payments.ts                  # POST /initiate
│   │   │   └── webhooks.ts                  # POST /paystack
│   │   ├── services/
│   │   │   ├── pricingService.ts            # computePrice(), getPricingGrid()
│   │   │   ├── bookingService.ts            # validateBookingInput(), createBooking()
│   │   │   ├── matchingService.ts           # matchCleaner() → ranked string[]
│   │   │   ├── assignmentService.ts         # assignCleaner() → { outcome, cleanerId }
│   │   │   ├── availabilityService.ts       # getAlternativeDates()
│   │   │   ├── paymentService.ts            # initializePayment() → Paystack checkout URL
│   │   │   ├── notificationService.ts       # stubs — wire to Termii in Section 5
│   │   │   └── refundService.ts             # issueRefund() — live Paystack call, safety net only
│   │   ├── app.ts
│   │   ├── config.ts
│   │   └── server.ts
│   ├── pnpm-workspace.yaml     # packages: ['.'], allowBuilds: esbuild
│   └── package.json
├── supabase/
│   └── migrations/
│       ├── 20260617000001_schema.sql               # all 10 tables
│       ├── 20260617000002_seed.sql                 # zones, services, pricing, addons
│       ├── 20260617000003_rls.sql                  # RLS enabled, no permissive policies
│       └── 20260617000004_assign_cleaner_fn.sql    # assign_cleaner() Postgres fn — applied ✅
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
| `cleaners` | id, first_name, last_name, phone (unique), photo_url, zone_id→zones, status ('active'/'inactive'/'suspended'), nin_verified, rating (1–5), total_jobs | no test data seeded yet |
| `cleaner_availability` | id, cleaner_id→cleaners, available_date (date), is_booked | UNIQUE (cleaner_id, available_date) |
| `customers` | id, first_name, last_name, phone (unique), email | upserted on phone at booking time |
| `bookings` | id, customer_id, cleaner_id (null until matched), requested_cleaner_id, zone_id, service_id, bedrooms, booking_date, address, total_amount_kobo, commission_kobo, status, paystack_reference, refunded_at, created_at, updated_at | updated_at trigger |
| `booking_addons` | id, booking_id→bookings, addon_id→addons | UNIQUE (booking_id, addon_id) |
| `ratings` | id, booking_id (unique)→bookings, customer_id, cleaner_id, score (1–5 CHECK), comment | — |

**Booking status flow:** `pending_payment` → `matched` → `confirmed` → `completed` / `cancelled` / `no_match`

- `pending_payment` — booking row created, assignment in progress
- `matched` — cleaner assigned (set by assign_cleaner Postgres RPC); customer can now pay
- `confirmed` — payment received via webhook; cleaner notified
- `no_match` — no cleaner available for that date (customer sees 409, never reaches payment)

**Amounts:** all stored as integers in **kobo** (1 NGN = 100 kobo). API responses return NGN.

**recent_jobs** is NOT a stored column — computed at match time as `COUNT(*) of bookings WHERE cleaner_id = x AND booking_date >= CURRENT_DATE - INTERVAL '7 days'`.

---

## API Endpoints

Base URL (production): `https://klova-production.up.railway.app`

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Returns `{ ok: true }` |
| GET | `/pricing` | Full pricing grid + add-on list for the frontend calculator |
| POST | `/bookings` | Creates booking, immediately assigns cleaner, returns `booking_id` + cleaner profile |
| GET | `/availability/alternatives` | `?zone_slug=lekki-ajah&date=2026-07-01` → available dates in next 14 days |
| POST | `/payments/initiate` | `{ booking_id }` → Paystack `authorization_url` + `reference` (booking must be `matched`) |
| POST | `/webhooks/paystack` | Paystack webhook — HMAC verify, `charge.success` → `confirmed`, notify cleaner |

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
{
  "ok": true,
  "data": {
    "booking_id": "uuid",
    "total_amount": 13000,
    "commission_amount": 2860,
    "commission_rate": 0.22,
    "cleaner": {
      "id": "uuid",
      "first_name": "Chidi",
      "last_name": "Okafor",
      "photo_url": "https://...",
      "rating": 4.8,
      "total_jobs": 42
    }
  }
}
```

**No cleaners available (409):**
```json
{ "error": { "message": "No cleaners available in lekki-ajah on 2026-07-01. Try a different date." } }
```

**Validation error (400):**
```json
{ "error": { "message": "Validation failed", "fields": { "phone": "phone is required." } } }
```

---

## Key Service Functions

### `pricingService.ts`
- `computePrice(serviceSlug, bedrooms, addonSlugs[])` → `PriceBreakdown` — server-side source of truth. Returns `service_id`, `addon_ids`, `base_amount`, `addons_amount`, `total_amount`, `commission_amount`, `commission_rate` (all NGN). Throws `ValidationError` (400) for unknown service, invalid bedrooms, unknown add-ons.
- `getPricingGrid()` → `PricingGrid` — all services with price grids + all add-ons.

### `bookingService.ts`
- `validateBookingInput(body)` → `BookingInput` — pure sync, no DB. Collects ALL field errors before throwing `FieldValidationError`.
- `createBooking(input)` → `BookingResult` — validates zone, computes price, upserts customer, inserts booking, calls `assignCleaner()` immediately, fetches cleaner profile, returns everything. Throws `NoAvailabilityError` (409) if no_match.

### `matchingService.ts`
- `matchCleaner(booking)` → `string[] | 'NO_MATCH'` — pure selection, no DB writes. Priority: [P1 requested cleaner?, P2 customer's 5-star picks, P3 general pool by rating/load]. Returns ranked ID list for RPC fallback.

### `assignmentService.ts`
- `assignCleaner(bookingId, booking)` → `{ outcome: 'matched'; cleanerId: string } | { outcome: 'no_match' }` — calls `matchCleaner()` then the `assign_cleaner` Postgres RPC (SELECT FOR UPDATE concurrency). No longer takes `paystackReference` — assignment is pre-payment.

### `availabilityService.ts`
- `getAlternativeDates(zoneSlug, requestedDate, days=14)` → `string[]` — dates in next N days with at least one free cleaner slot in the zone.

### `paymentService.ts`
- `initializePayment(bookingId)` → `PaymentInitResult` — booking must be `matched`; calls Paystack `/transaction/initialize` with kobo amount + customer email; stores reference on booking row.
- Exports `PaymentError` class (has `.status`).

### `refundService.ts`
- `issueRefund(bookingId, paystackReference)` → live Paystack `/refund` call. Guards: skips if no `paystack_reference`, skips if `refunded_at` already set (double-refund protection), sets `refunded_at` on success. **Not called automatically** — available as a safety net for manual use.

### `notificationService.ts`
- `notifyCustomerConfirmed(bookingId)` — sends SMS to customer via Termii
- `notifyCleanerAssigned(bookingId)` — sends SMS to cleaner via Termii
- `notifyAdminConfirmed(bookingId)` — sends SMS to `ADMIN_PHONE` via Termii (skipped if unset)
- All three are **graceful-failure**: Termii errors are caught and logged; a failed SMS never rolls back a confirmed booking.

### `termiiClient.ts` (`api/src/lib/`)
- `sendSms(to, message)` — sends via Termii `generic` channel
- `sendWhatsApp(to, message)` — sends via Termii `whatsapp` channel (requires WhatsApp Business integration approval in Termii dashboard)
- `normalizePhone(raw)` — accepts `0803…`, `+234803…`, `234803…` → `2348XXXXXXXXX`

### `messageTemplates.ts` (`api/src/lib/`)
- All three message templates in one place: `customerConfirmedMsg`, `cleanerAssignedMsg`, `adminConfirmedMsg`

### Error classes
- `ValidationError` — status 400, from pricingService
- `FieldValidationError` — status 400, from bookingService (has `.fields`)
- `NoAvailabilityError` — status 409, from bookingService when no_match
- `PaymentError` — status 400/404/502/503, from paymentService

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
| 2.3 Schema + seed | ✅ Done | 10 tables, 4 migration files, pricing/zones/services/addons seeded |
| 2.4 Row-level security | ✅ Done | RLS on all tables, zero anon access, service role bypasses |
| 3.1 Pricing service | ✅ Done | computePrice(), GET /pricing, 5 passing tests |
| 3.2 Booking creation | ✅ Done | POST /bookings — validates, assigns cleaner immediately, returns cleaner profile |
| 3.3 Matching algorithm | ✅ Done | matchCleaner() — 3-tier priority, returns ranked candidate list |
| 3.4 Concurrency-safe assignment | ✅ Done | assignCleaner() + assign_cleaner Postgres RPC (SELECT FOR UPDATE) |
| 3.5 No-availability experience | ✅ Done | getAlternativeDates(), GET /availability/alternatives, 409 on no_match |
| 3.6a Paystack payment init | ✅ Done | POST /payments/initiate — booking must be matched; stores reference |
| 3.6b Paystack webhook | ✅ Done | POST /webhooks/paystack — HMAC verify, matched→confirmed, notify stubs |
| 3.7 Refund service | ✅ Done | issueRefund() — live Paystack call, double-refund guard, sets refunded_at |
| 3.8 Flow rewire | ✅ Done | Assignment at booking time (not webhook); webhook just confirms + notifies |
| 5.1 Termii notifications | ✅ Done | sendSms + sendWhatsApp, phone normalisation, graceful failure, message templates |

**41 tests passing. Backend is feature-complete for the booking flow.**

**Next: Prompt 4.1 — Booking flow frontend (multi-step form: service → date → customer details → cleaner reveal → pay)**

**Blocker to test end-to-end:** No cleaners seeded in DB. Need to insert a cleaner + availability row before POST /bookings can return a matched result.

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
PAYSTACK_SECRET_KEY=         # used for both API calls and HMAC webhook verification
PAYSTACK_PUBLIC_KEY=
TERMII_API_KEY=
TERMII_SENDER_ID=
COMMISSION_RATE=0.22
FRONTEND_ORIGIN=             # CORS allowed origin
```

**Railway env vars set:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`, `PORT`, `COMMISSION_RATE`, `FRONTEND_ORIGIN`

**To add for notifications (Railway + local .env):** `TERMII_API_KEY`, `TERMII_SENDER_ID`, `ADMIN_PHONE`

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

# Push to deploy (Railway + Vercel auto-deploy on push to main)
git push origin main
```

**pnpm notes:**
- `web/pnpm-workspace.yaml` — must have `packages: ['.']` and `allowBuilds: { sharp, unrs-resolver }`
- `api/pnpm-workspace.yaml` — must have `packages: ['.']` and `allowBuilds: { esbuild }`
- Both files need the `packages` field or pnpm v9 fails with "packages field missing or empty"

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
- **Repo root is `/Users/reoxt` (home directory)** — git commands work from anywhere but paths in commits are relative to home
- Vercel auto-deploys on push to `main`
- Railway auto-deploys on push to `main` (root dir: `Downloads/Klova/api`)
- Commit style: `feat(web):`, `fix(web):`, `refactor(web):`, `feat(api):`, `feat(db):` etc.
