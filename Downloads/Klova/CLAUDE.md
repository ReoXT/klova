# Klova — Project Context

Full build guide: `Klova Prompts.md`. Schema, pricing, matching logic: `MASTER-ROADMAP.md`.

---

## What Klova Is

On-demand home cleaning for Lagos, Nigeria. Customers book → get assigned a vetted cleaner instantly → see cleaner profile → pay. V1 is Lekki/Ajah only.

**Core differentiator:** NIN-verified, rated cleaners shown before payment.

**Booking flow:**
1. Customer fills in service, date, address
2. Backend assigns best available cleaner immediately (pre-payment)
3. Customer sees cleaner profile → pays via Paystack
4. Paystack webhook confirms payment → booking → `confirmed` → cleaner notified via SMS

**Pricing (live in DB):**

| Service | 1-bed | 2-bed | 3-bed | 4-bed+ |
|---|---|---|---|---|
| Standard Clean | ₦5,000 | ₦9,500 | ₦14,000 | ₦18,000 |
| Deep Clean | ₦18,500 | ₦30,000 | ₦44,000 | ₦65,000 |
| Move-in / Move-out | ₦40,000 | ₦56,000 | ₦74,000 | ₦90,000 |
| Post-construction | ₦45,000 | ₦66,000 | ₦88,000 | ₦110,000 |

**Add-ons:** Laundry ₦3,500 · Ironing ₦4,600 · Wardrobe organising ₦4,000

**Commission:** 22% (`COMMISSION_RATE=0.22`). All amounts stored in **kobo**; API returns NGN.

**Zones:** `lekki-ajah` (live). VI / Ikeja / Surulere seeded with `is_active = false`.

---

## Tech Stack (fixed — do not change)

| Layer | Choice |
|-------|--------|
| Frontend | Next.js App Router, TypeScript, Tailwind v4, daisyUI v5.5.23, pnpm v11.7.0 |
| Backend | Node.js + Express + TypeScript → Railway |
| Database | Supabase (Postgres + RLS on all 10 tables, service role key bypasses RLS) |
| Payments | Paystack (test keys) |
| Notifications | Termii (SMS/WhatsApp) |
| Frontend hosting | Vercel — https://klova-nine.vercel.app |
| Backend hosting | Railway — https://klova-production.up.railway.app |
| Tests | Vitest (api/ only) — 41 passing |

**Tailwind v4:** NO `tailwind.config.js`. All config in `web/app/globals.css` via `@import "tailwindcss"` + `@plugin "daisyui"`. Theme is `data-theme="klova"`, OKLCH colors.

**Git repo root is `/Users/reoxt` (home dir).** Railway root dir: `Downloads/Klova/api`.

---

## Monorepo Structure

```
Klova/
├── web/                     # Next.js → Vercel
│   ├── app/
│   │   ├── layout.tsx       # Root layout, fonts, data-theme="klova"
│   │   ├── globals.css      # Design system — ALL tokens, grids, animations live here
│   │   ├── (site)/          # Public pages with SiteNav + SiteFooter
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx     # Landing page (fully implemented)
│   │   │   └── terms/ privacy/ cancellation/
│   │   ├── book/            # Booking flow (Prompt 4.1 — in progress)
│   │   └── styleguide/
│   ├── components/
│   │   ├── layout/SiteNav.tsx SiteFooter.tsx
│   │   └── ui/              # Button FormField(+SelectField) Card(+CardBody)
│   │                        # Skeleton(+SkeletonText/Card/Avatar) Spinner EmptyState Alert
│   └── public/logo.svg      # Squircle logo, viewBox 459×459, always render square
├── api/src/
│   ├── services/            # pricingService bookingService matchingService
│   │                        # assignmentService availabilityService paymentService
│   │                        # notificationService refundService
│   ├── controllers/ routes/ middleware/ lib/
│   └── __tests__/           # 41 tests
└── supabase/migrations/     # 4 files: schema, seed, rls, assign_cleaner fn
```

---

## Database

10 tables, RLS enabled, anon key has zero access.

**Key tables:** `zones` `services` `pricing` `addons` `cleaners` `cleaner_availability` `customers` `bookings` `booking_addons` `ratings`

**Booking status flow:** `pending_payment` → `matched` → `confirmed` → `completed` / `cancelled` / `no_match`

- `matched` — cleaner assigned by `assign_cleaner` Postgres RPC (SELECT FOR UPDATE); customer can pay
- `confirmed` — Paystack webhook received; cleaner notified
- `no_match` — no cleaner available; customer gets 409

**No cleaners seeded yet** — insert a `cleaners` row + `cleaner_availability` row before end-to-end testing.

---

## API Endpoints

Base: `https://klova-production.up.railway.app`

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | `{ ok: true }` |
| GET | `/pricing` | Full grid + add-ons for frontend calculator |
| POST | `/bookings` | Create booking + assign cleaner; returns `booking_id` + cleaner profile |
| GET | `/availability/alternatives` | `?zone_slug=lekki-ajah&date=YYYY-MM-DD` → dates in next 14 days |
| POST | `/payments/initiate` | `{ booking_id }` → Paystack `authorization_url` (booking must be `matched`) |
| POST | `/webhooks/paystack` | HMAC verify → `matched→confirmed` → notify customer + cleaner |

---

## Component Rules

Always use `components/ui/` — never inline raw daisyUI when a primitive exists.

- Button → `Button`
- Text/email/tel input → `FormField`
- Select → `SelectField` (from FormField)
- Card → `Card` + `CardBody`
- Loading → `SkeletonCard`, `SkeletonText`, `SkeletonAvatar`, `Spinner`
- Empty state → `EmptyState`
- Alert → `Alert` with `alert-soft` variant

Design tokens live in `globals.css` as CSS variables (`--text-muted`, `--surface-card`, etc.). Use `style={{ color: "var(--text-muted)" }}` for tokens Tailwind can't reach — this is intentional.

Fonts: `--font-dm-serif` (headings, auto-applied) · `--font-plus-jakarta` (body). Use `.wordmark` class on every "Klova" brand name.

---

## Current Work: Prompt 4.1 — Booking Flow Frontend

**Route:** `web/app/book/` (NOT inside `(site)/`). SiteNav "Book a cleaning" and FinalCTA both point to `/book`.

**5 steps:**
1. **Service** — service type + bedrooms + add-ons. Fetch `GET /pricing`, show live price as selections change.
2. **Date** — date picker. Zone always `lekki-ajah`. On no availability → call `GET /availability/alternatives` and show date chips.
3. **Details** — first name, last name, phone, email, address. Use `FormField`.
4. **Cleaner reveal** — `POST /bookings`, show Spinner, reveal cleaner profile (photo, name, rating, total_jobs, NIN badge). CTA: "Looks good — pay now". Handle 409 (no match) + 400 field errors inline.
5. **Payment** — `POST /payments/initiate` → redirect to Paystack URL. On return, show "Booking confirmed, you'll get an SMS shortly."

**Rules:**
- Never compute totals in the browser — display what the API returns
- Single `useBooking` hook or context for all step state
- Store `booking_id` in `sessionStorage` (not URL params)
- `photo_url` may be null — always show avatar fallback
- Format amounts as `₦X,XXX` NGN everywhere

---

## Security Rules (never break)

1. `.env` files never committed — only `.env.example` with blank values
2. `SUPABASE_SERVICE_ROLE_KEY` — server only, never in frontend or git
3. All pricing computed server-side — never trust browser-sent prices
4. Paystack webhook is the ONLY trusted payment confirmation — not the redirect
5. Frontend never talks to Supabase directly — always via Express API
6. Admin routes must be behind Supabase auth

---

## Environment Variables

`web/.env` → `NEXT_PUBLIC_API_URL`

`api/.env` → `PORT` `SUPABASE_URL` `SUPABASE_ANON_KEY` `SUPABASE_SERVICE_ROLE_KEY` `PAYSTACK_SECRET_KEY` `PAYSTACK_PUBLIC_KEY` `TERMII_API_KEY` `TERMII_SENDER_ID` `COMMISSION_RATE` `FRONTEND_ORIGIN` `ADMIN_PHONE`

Railway has: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`, `PORT`, `COMMISSION_RATE`, `FRONTEND_ORIGIN`. Still need: `TERMII_API_KEY`, `TERMII_SENDER_ID`, `ADMIN_PHONE`.

---

## Commands

```bash
cd web && pnpm dev        # frontend :3000
cd api && pnpm dev        # backend :4000
cd api && pnpm test       # 41 tests
git push origin main      # deploys both Vercel + Railway
```

## Git

- Branch: `main` · Remote: `https://github.com/ReoXT/klova.git`
- Commit style: `feat(web):` `fix(web):` `feat(api):` `feat(db):` etc.
- Vercel auto-deploys on push. Railway auto-deploys (root: `Downloads/Klova/api`).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
