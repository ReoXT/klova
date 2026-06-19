# Lagos On-Demand Cleaning Service — Master Roadmap & MVP Build Plan

**Version 1.0 · Pre-launch build guide for a solo founder**

This is your single source of truth. Keep it open. Every section is built to be detailed enough that you can copy the relevant part into a fresh chat and go deep on just that piece. The last section gives you ready-to-paste prompts to start each of those chats.

---

## 0. How to use this document

You are building alone, so the danger is not "what do I do" — it's doing everything at once and finishing nothing. This roadmap is sequenced so that **two tracks run in parallel** and nothing blocks on something it shouldn't:

- **Track A — Software** (you, coding): backend → frontend → admin → testing.
- **Track B — Operations** (you, offline): recruit and vet cleaners, set pricing, line up launch demand.

Track B has long lead times (people are slow), so it **starts on day one** and runs the whole way through. Don't wait until the site is built to start recruiting — by then you'll have a product with no supply.

The realistic timeline for a solo hybrid-technical founder who is still learning to code is **8–10 weeks** to first real bookings. If you're coding full-time it compresses to 6. Treat the week numbers below as sequence, not a promise — hitting the milestone matters more than hitting the date.

---

## 1. Timeline at a glance

| Week | Software (Track A)                                | Operations (Track B)                               |
| ---- | ------------------------------------------------- | -------------------------------------------------- |
| 0    | Decisions, accounts, domain, repo, stack scaffold | Write job posts, pricing draft, decide launch zone |
| 1    | Database schema + Supabase setup                  | Post jobs, start interviewing                      |
| 2    | Matching algorithm + booking API                  | Interview + vet, run NIN checks                    |
| 3    | Paystack integration + SMS notifications          | Onboard first 5 cleaners, collect docs             |
| 4    | Booking flow frontend + pricing calculator        | Continue to 10–12 cleaners, training brief         |
| 5    | Cleaner profiles + confirmation screens           | Finalise availability for first 2 weeks            |
| 6    | Admin panel                                       | Pre-launch waitlist / demand building              |
| 7    | Closed testing (friends + real cleaners)          | Run 5–10 free/discounted test cleans               |
| 8    | Fix what testing broke                            | Collect testimonials, photos, reviews              |
| 9    | Launch checklist + soft launch                    | Public launch in ONE zone                          |
| 10   | Monitor, patch, iterate                           | Push to first 20 paid bookings                     |

**Launch in one zone first.** Lekki/Ajah is the right first zone: highest concentration of your target customer, highest willingness to pay, and you can recruit cleaners who live on the corridor so commutes are short. Add zone two only after the first is working.

---

## 2. Pre-build phase (Week 0)

### 2.1 Decisions to lock before you write any code

These are cheap to decide now and expensive to change later.

- **Business name + domain.** Pick a name that's short, easy to say on a phone call, and has a `.com` or `.ng` available. Buy the domain on Namecheap or Vercel domains the same day. Grab the matching Instagram + WhatsApp Business handle even if you don't use them yet.
- **Legal entity.** You can launch as a registered business name (cheapest, fast via CAC) and upgrade to a Limited company before you raise. For VC money you will eventually need an **RC-numbered Ltd**, and most likely a **Delaware C-Corp + Nigerian subsidiary** structure at raise time — but do NOT spend money on that now. Register a CAC business name (~₦20–25k via a service like Lawpadi or directly on the CAC portal) so you can open a corporate Paystack + bank account. That's all you need to launch.
- **Bank account.** Open a corporate/business account so customer money and your money never mix. Paystack settles into this. A fintech business account (e.g. a neobank for SMEs) is faster to open than a traditional bank.
- **Pricing model.** See Section 9 — decide your starter price grid now because it drives the booking calculator you'll build in Week 4.
- **Cancellation / refund policy.** Decide the rule now (suggested: free cancellation 24h before, 50% within 24h, no refund after cleaner dispatched). You'll need it for the booking terms and Paystack disputes.

### 2.2 Accounts to create (all free to start)

- **GitHub** — one repo, private. Even solo, commit daily. This is your undo button.
- **Supabase** — free tier is plenty for launch. This is your Postgres DB + auth.
- **Vercel** — frontend hosting, free tier.
- **Railway or Render** — backend hosting. Render's free tier sleeps after inactivity (bad for a payment webhook); Railway's usage-based pricing is worth the few dollars. **Use Railway** for the backend so your Paystack webhook is always awake.
- **Paystack** — sign up, start business verification immediately (it takes days; do it Week 0 so it's ready by Week 3).
- **Termii** — Nigerian SMS/WhatsApp sender, cheaper and more reliable for local numbers than Twilio. Start their sender-ID approval now (also takes days).

### 2.3 Stack scaffold (Week 0 coding)

Get a "hello world" deployed end-to-end before building features. This proves your pipeline works so you're not debugging deployment and logic at the same time later.

1. `npx create-next-app@latest` with Tailwind — deploy the empty app to Vercel.
2. Create an Express server (`/api/health` returns `{ok: true}`) — deploy to Railway.
3. Create the Supabase project, connect it, run one test query from the backend.
4. Confirm the chain works: Next.js page → calls Express endpoint → reads from Supabase → renders. Once that round-trip works, you've de-risked the hardest part of solo full-stack.

**You personally handle:** all of Week 0. No delegating. This sets the foundation you'll build on.

---

## 3. Cleaner recruitment & vetting (Track B — starts Week 0, runs to Week 6)

This is the part most marketplace founders underestimate. **No cleaners = no product**, and good cleaners are hard to find and slow to vet. Start now.

### 3.1 Where to recruit

In rough order of quality-for-effort:

- **Referrals from people you trust** — best source. Ask everyone you know if they have a cleaner/house help they rate. One great cleaner referring three others is your fastest path to 10.
- **Jobberman** — post a paid listing; reaches serious job seekers.
- **Facebook Groups** — Lagos jobs groups, area-specific groups (e.g. Lekki community groups).
- **WhatsApp Status + flyers** at markets, salons, and estates on the Lekki corridor.
- **LinkedIn** — lower hit rate for this role but free.

### 3.2 The job post (use this)

> **Hiring: Professional Home Cleaners (Lekki/Ajah) — Flexible, Paid Weekly**
>
> A new home-cleaning service is hiring reliable, detail-oriented cleaners on the Lekki–Ajah corridor. You'll be matched with cleaning jobs near you and paid per job, weekly. No fees to join.
>
> **You must have:** a valid NIN, a smartphone with WhatsApp, references, and a track record of cleaning homes professionally.
> **We value:** punctuality, honesty, and pride in your work.
>
> To apply, send a WhatsApp message to [number] with your full name, area you live, and years of cleaning experience.

Keep applications flowing into **one WhatsApp number** so you can triage fast.

### 3.3 Interview format (30–40 min, in person or video)

Run every candidate through the same structure so you can compare fairly.

**Part 1 — Basics & motivation (5 min)**

- Where do you live exactly? (Must be within or near a launch zone — short commutes = reliability.)
- How do you currently get cleaning work? Why are you looking?
- Do you have a smartphone and reliable WhatsApp?

**Part 2 — Experience & competence (10 min)**

- Walk me through how you'd deep-clean a kitchen, start to finish. _(You're listening for method and thoroughness, not perfect English.)_
- What cleaning agents do you use for a bathroom vs. a wooden floor? _(Tests real knowledge — wrong chemicals damage customer homes.)_
- Tell me about a time a client was unhappy. What happened and what did you do?

**Part 3 — Reliability & conduct (10 min)**

- If you're matched a job for 9am Saturday, what time do you leave home? _(Listening for buffer/planning.)_
- A customer isn't home when you arrive but the door is open. What do you do? _(Listening for boundaries and honesty — should not enter, should call.)_
- You finish early. Do you leave, or do you check your work again? _(Listening for standards.)_

**Part 4 — Logistics (5 min)**

- Which days/times are you available each week?
- Are you okay being paid per job, weekly, via transfer?
- Do you have two references I can call?

**Scoring:** rate each candidate 1–5 on Competence, Reliability, Communication, Trustworthiness. Only onboard 4+ averages. Better to launch with 6 great cleaners than 15 mediocre ones — your whole brand is "the cleaner who enters your home is vetted and good."

### 3.4 Vetting checklist (do not skip)

- [ ] **NIN verification** — verify the NIN is real and matches the name/face. Use a verification API (Dojah, Prembly/Identitypass, or VerifyMe Nigeria) or NIMC lookup. This is your single most important trust signal to customers.
- [ ] **Photo** — clear, recent face photo for their profile.
- [ ] **Two references called** — actually call them. Ask: would you hire this person again, were they honest, were they reliable.
- [ ] **Home address confirmed** — and within commuting range of the zone.
- [ ] **Phone number confirmed on WhatsApp.**
- [ ] **Signed conduct agreement** — a one-page document: punctuality, no entering rooms unasked, no touching valuables, report damage immediately, platform sets pricing, payment is per completed job. Keep it simple and in plain English.

### 3.5 Training brief (1–2 hours, group session)

Once you have your first batch, run one group session covering: arrival/punctuality standards, what "standard" vs "deep" clean includes, conduct in customer homes, how dispatch works (you'll WhatsApp them a job; they confirm within X minutes; they show up), how rating works and why it matters to their job flow, and how/when they get paid.

**You personally handle:** all interviews and vetting. This is the part of the business you cannot delegate or automate in V1 — your judgment of these people IS the product's safety guarantee.

**Target:** 6 vetted cleaners to start, 10–12 by public launch, all in your first launch zone.

---

## 4. Backend build (Weeks 1–3)

### 4.1 Database schema (Week 1)

Build these tables in Supabase. This schema supports everything in V1 and won't need a painful migration later.

```sql
-- ZONES
CREATE TABLE zones (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,            -- 'Lekki/Ajah'
  is_active BOOLEAN DEFAULT true
);

-- CLEANERS
CREATE TABLE cleaners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  photo_url TEXT,
  nin_verified BOOLEAN DEFAULT false,
  zone_id INT REFERENCES zones(id),
  rating NUMERIC(2,1) DEFAULT 5.0,   -- starts at 5.0, average of customer ratings
  total_jobs INT DEFAULT 0,          -- lifetime completed jobs (for display)
  status TEXT DEFAULT 'active',      -- 'active' | 'inactive' | 'suspended'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CLEANER AVAILABILITY (one row per available date)
CREATE TABLE cleaner_availability (
  id SERIAL PRIMARY KEY,
  cleaner_id UUID REFERENCES cleaners(id),
  available_date DATE NOT NULL,
  is_booked BOOLEAN DEFAULT false,   -- flips true when assigned
  UNIQUE (cleaner_id, available_date)
);

-- CUSTOMERS
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  zone_id INT REFERENCES zones(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SERVICES & PRICING
CREATE TABLE services (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,                -- 'Standard', 'Deep', 'Move-out', 'Post-construction'
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE pricing (
  id SERIAL PRIMARY KEY,
  service_id INT REFERENCES services(id),
  apartment_size TEXT NOT NULL,      -- '1bed','2bed','3bed','4bed+'
  base_price NUMERIC NOT NULL
);

CREATE TABLE addons (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,                -- 'Laundry','Ironing','Wardrobe organisation'
  price NUMERIC NOT NULL,
  is_active BOOLEAN DEFAULT true
);

-- BOOKINGS
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  cleaner_id UUID REFERENCES cleaners(id),   -- null until matched
  zone_id INT REFERENCES zones(id),
  service_id INT REFERENCES services(id),
  apartment_size TEXT NOT NULL,
  booking_date DATE NOT NULL,
  addons JSONB DEFAULT '[]',
  total_amount NUMERIC NOT NULL,
  commission_amount NUMERIC,                  -- your cut, computed at booking
  requested_cleaner_id UUID,                  -- if customer asked for a specific cleaner
  status TEXT DEFAULT 'pending_payment',      -- pending_payment | paid | matched | confirmed | completed | cancelled | no_match
  payment_ref TEXT,                           -- Paystack reference
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RATINGS
CREATE TABLE ratings (
  id SERIAL PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id),
  customer_id UUID REFERENCES customers(id),
  cleaner_id UUID REFERENCES cleaners(id),
  stars INT CHECK (stars BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**One important refinement to your spec:** for load balancing, don't sort by lifetime `total_jobs` — a great cleaner who's done 200 jobs over a year would always lose to a newcomer, which is backwards. Load-balance on **recent** jobs (last 7 days). Keep `total_jobs` for display ("180 cleans completed") but compute a separate `recent_jobs` count at match time. The schema above supports this — you count `bookings` in the last 7 days per cleaner inside the matching query.

### 4.2 The matching algorithm (Week 2 — this is your core IP)

Your spec lists six priorities. Layered correctly, the resolution order is: **requested cleaner → preferred cleaner → general pool.** Here's the full logic:

```
function matchCleaner(booking):
    candidates = cleaners WHERE
        zone_id = booking.zone_id
        AND status = 'active'
        AND EXISTS availability(cleaner, booking.booking_date, is_booked = false)

    if candidates is empty:
        return NO_MATCH   -- triggers the honest "no availability" message

    -- Priority 1 & 6: customer explicitly requested a specific cleaner
    if booking.requested_cleaner_id in candidates:
        return booking.requested_cleaner_id

    -- Priority 5: customer's preferred cleaner (someone they rated 5 stars before)
    preferred = cleaners this customer has rated 5 stars, intersected with candidates
    if preferred is not empty:
        return preferred ordered by rating DESC, recent_jobs ASC -> top

    -- General pool: Priority 2 (availability, already filtered),
    -- 3 (rating), 4 (load balance on recent jobs)
    return candidates ordered by rating DESC, recent_jobs ASC -> top
```

Where `recent_jobs` = count of that cleaner's bookings in the last 7 days. As SQL for the general-pool case:

```sql
SELECT c.*,
  (SELECT COUNT(*) FROM bookings b
   WHERE b.cleaner_id = c.id
   AND b.booking_date >= CURRENT_DATE - INTERVAL '7 days') AS recent_jobs
FROM cleaners c
JOIN cleaner_availability ca ON ca.cleaner_id = c.id
WHERE c.zone_id = $1
  AND c.status = 'active'
  AND ca.available_date = $2
  AND ca.is_booked = false
ORDER BY c.rating DESC, recent_jobs ASC
LIMIT 1;
```

**Critical:** when a match is made, wrap the assignment + the `is_booked = true` flip in a **database transaction** so two simultaneous bookings can't grab the same cleaner for the same date. This is the kind of bug that quietly double-books and destroys trust. Lock the availability row (`SELECT ... FOR UPDATE`) inside the transaction.

**When `NO_MATCH`:** set booking status to `no_match`, do NOT take payment (or refund immediately if already captured), and return the "no availability for this date — here are dates that ARE available" response. Bonus: query which nearby dates the zone's cleaners are free, and offer those.

### 4.3 Paystack integration (Week 3)

The correct, secure flow — never trust the frontend to tell you a payment succeeded:

1. Customer fills booking form → frontend calls your backend `POST /bookings` → you create a booking with status `pending_payment` and compute `total_amount` **server-side** (never trust a price sent from the browser).
2. Backend initialises a Paystack transaction, returns the authorization URL/reference to the frontend.
3. Customer pays on Paystack.
4. **Paystack calls your webhook** (`POST /webhooks/paystack`). This is the only event you trust. Verify the signature using your Paystack secret key.
5. On verified `charge.success`: run the matching algorithm, assign the cleaner inside a transaction, set status `matched`, fire the SMS, and notify yourself (the admin).
6. If `NO_MATCH`: trigger a refund via Paystack's refund API and notify the customer.

Compute and store `commission_amount` (your percentage) at booking time so revenue reporting is trivial later. **Suggested commission: 20–25%** of the booking value — standard for managed marketplaces where the platform sets price and guarantees quality.

### 4.4 Notifications (Week 3)

Via Termii, on `matched`:

- **To customer (SMS + WhatsApp):** "Your [service] on [date] is confirmed. Your cleaner [name], rated [X]★, will arrive at [time]. Track or manage: [link]."
- **To you (admin):** "New paid booking: [service], [zone], [date]. Auto-matched: [cleaner name]. Confirm with cleaner."

You then WhatsApp/call the cleaner to confirm dispatch (the manual step that's expected in V1). Once the cleaner confirms, flip status to `confirmed` in the admin panel, which can fire a final "you're all set" SMS.

**You personally handle:** all backend. Don't delegate your core matching logic — it's your moat and you need to understand it cold when you pitch investors.

---

## 5. Frontend build (Weeks 4–5)

Mobile-first. Most of your Lagos customers will book from a phone. Design for a thumb on a 5–6" screen, then let it scale up.

### 5.1 Pages to build

1. **Landing page** — what it is, trust signals (vetted, rated, verified cleaners), the zones you serve, one clear "Book a cleaning" button. No fluff.
2. **Booking flow** (the heart of it) — see 5.2.
3. **Cleaner profiles** — shown after match: photo, first name, rating, completed-cleans count, verified badge. This is a key differentiator over Shaaré — the customer sees who's coming before they arrive.
4. **Confirmation screen** — booking summary, cleaner card, date/time, total paid, what to expect, support contact.
5. **"No availability" screen** — honest, with alternative dates. Never a dead end.

### 5.2 Booking flow (step-by-step, single scroll or wizard)

1. **Select zone** (Lekki/Ajah only at launch — but build the dropdown to support all four).
2. **Select service** (Standard / Deep / Move-out / Post-construction) with a one-line description and price-from each.
3. **Select apartment size** (1/2/3/4-bed+).
4. **Add-ons** (laundry, ironing, wardrobe) — checkboxes with prices.
5. **Pick date** (calendar; you can grey out dates with zero zone availability if you want to reduce no-matches).
6. **Live price calculator** — updates as they change selections, pulling from your `pricing` + `addons` tables. Show the total prominently.
7. **Optional: request a specific cleaner** — only surface this for returning customers who have a preferred cleaner; for new customers, hide it.
8. **Enter details** (name, phone, email, address).
9. **Pay with Paystack.**
10. **Land on confirmation** (or no-availability) screen.

**Pricing calculator rule:** the browser can _show_ a price for UX, but the **backend recomputes and is the source of truth** before charging. Never let the displayed price be the price charged without server verification.

### 5.3 Build order for a solo dev

Build the booking flow against fake/hardcoded data first, get the UI feeling right, _then_ wire it to your real backend endpoints. Don't try to make it pretty and functional in the same pass — you'll thrash. Get it working, then get it nice.

**You personally handle:** all of it, but this is where you'll lean hardest on AI help. Spin a dedicated chat per screen (see Section 12).

---

## 6. Admin panel build (Week 6)

Your private operations cockpit. Keep it ugly and functional — it's for you, not customers. Protect it behind Supabase auth (just your login).

Screens:

- **Bookings dashboard** — live list of all bookings, newest first, with status, zone, date, amount, and the auto-assigned cleaner. Filter by status and zone.
- **Match override** — on any booking, a dropdown to reassign to a different available cleaner if the auto-match needs changing. Re-flips availability correctly when you do.
- **Cleaners manager** — add / edit / deactivate / suspend cleaners; upload photo; set zone; mark NIN verified.
- **Availability editor** — the one you'll touch most. A weekly grid per cleaner; tick the dates each cleaner is free. (V1 is manual — you update this weekly. This is in your "won't build" list to automate, correctly.)
- **Ratings view** — see ratings per cleaner, flag anyone trending below 4★.
- **Revenue summary** — total bookings, gross booking value, your total commission, for a date range. This is what you'll screenshot for investors.

Build this last because you can run the very first test bookings by reading the database directly in Supabase's table editor if you have to. But have it done before public launch — you can't run operations off raw SQL once volume picks up.

---

## 7. Testing phase (Week 7)

Do NOT go public without this. The goal is to find the breakage with people who forgive you, not paying strangers.

1. **End-to-end dry runs (you):** book as a fake customer 10+ times. Hit every path: each service, each size, with add-ons, the requested-cleaner path, the preferred-cleaner path, and deliberately book a date with no availability to confirm the no-match flow and the refund both fire.
2. **Payment edge cases:** test a failed payment, an abandoned payment, and a successful one. Confirm the webhook (not the frontend) is what creates the match. Test in Paystack **test mode** first, then do one real ₦100 live transaction to confirm production keys and settlement work.
3. **Real cleans with real cleaners (the big one):** run **5–10 free or heavily discounted cleanings** for friends, family, and your own network in the launch zone. Real customer, real cleaner, real match, real SMS, real clean. This validates the whole machine AND gives you:
   - Testimonials and before/after photos for marketing.
   - Real ratings to seed your cleaner profiles (profiles with "0 cleans, no rating" don't convert).
   - A gut check on whether your pricing and cleaner quality actually land.
4. **Concurrency test:** have two people book the same cleaner for the same date within seconds. Confirm only one gets the match and the other is handled cleanly. If this fails, fix the transaction locking before launch.

**You personally handle:** all testing. Watch every test clean's outcome personally — this is your last cheap chance to learn what's wrong.

---

## 8. Launch checklist (Week 9)

**Technical**

- [ ] Paystack in live mode, real keys in production env vars (never in code/git).
- [ ] Webhook URL registered with Paystack and verified working in production.
- [ ] Termii sender ID approved; SMS firing on real bookings.
- [ ] Domain live with SSL; site loads fast on mobile data (test on 4G, not just WiFi).
- [ ] Error logging on the backend (even just logging to the console on Railway) so you can see failures.
- [ ] Refund path tested live.
- [ ] Admin panel locked behind your login.

**Operations**

- [ ] 10–12 vetted cleaners, all with verified NIN, photo, and profile.
- [ ] First two weeks of availability filled in for every cleaner.
- [ ] Cleaners briefed and on standby; they know launch day is real.
- [ ] Your phone/WhatsApp ready to confirm dispatches fast — launch week you ARE the dispatch system.

**Trust & legal**

- [ ] Terms of service, privacy policy, cancellation/refund policy live on the site.
- [ ] Support contact (a WhatsApp number) visible everywhere.

**Marketing**

- [ ] Testimonials and before/after photos from test cleans on the landing page.
- [ ] Launch content ready (see Section 11).

**Soft launch first:** open to your waitlist and network for a few days before any paid ads. Catch the live-environment surprises with a friendly first wave.

---

## 9. Pricing model (decide in Week 0, build in Week 4)

Set prices yourself (platform-set pricing is a core decision). These are realistic **starter** numbers for the Lagos market in 2026 — validate against what your test customers will actually pay and adjust. All figures in Naira.

| Service            | 1-bed  | 2-bed  | 3-bed  | 4-bed+  |
| ------------------ | ------ | ------ | ------ | ------- |
| Standard cleaning  | 5,000  | 9,500  | 14,000 | 18,000  |
| Deep cleaning      | 18,500 | 30,000 | 44,000 | 65,000  |
| Move-in / move-out | 40,000 | 56,000 | 74,000 | 90,000  |
| Post-construction  | 45,000 | 66,000 | 88,000 | 110,000 |

**Add-ons (flat):** Laundry ₦3,500 · Ironing ₦4,600 · Wardrobe organisation ₦4,000.

**Your commission:** 22% of the booking. On a ₦20,000 standard 2-bed clean at 22%, you keep ₦4,400 and the cleaner gets ₦15,600. Make sure the cleaner's take is competitive with what they'd earn on their own, or you won't retain supply.

**How to validate:** during test cleans, ask customers point-blank what they'd expect to pay and whether the price feels fair for the result. Watch whether bookings cluster at certain services/sizes — that tells you where to sharpen pricing.

---

## 10. Metrics to track from day one

You can't raise money on vibes. Track these from your first booking (the admin revenue view + a simple spreadsheet is enough at first):

- **Bookings count** (daily/weekly).
- **Gross Booking Value (GBV)** and **your revenue** (commission).
- **No-match rate** — % of attempted bookings that hit "no availability." High = you need more supply, not more demand. This is your single most important early signal.
- **Repeat rate** — % of customers who book a second time. This is the number VCs care about most; it proves the product actually works.
- **Average rating** across cleans.
- **Cleaner utilisation** — are jobs spread evenly (your load-balancing working) or piling on a few?
- **Customer acquisition cost** once you start spending on ads.

First milestone that matters: **20 paid bookings and a measurable repeat rate.** That's your validation point before you push hard on growth or raise.

---

## 11. Marketing & growth strategy

You're targeting middle-class Lagos. Your edge isn't being cheapest — it's being **trustworthy and reliable** (vetted cleaners, see-who's-coming, no booking-into-a-void). Lead with trust in everything.

### 11.1 Pre-launch (Weeks 6–8): build demand before you need it

- **Waitlist landing page** up early — "Vetted home cleaning, coming to Lekki. Join the list for launch-week pricing." Collect phone numbers.
- **Content from your test cleans** — you produce video well; use it. Before/after reels, a cleaner's-day, "how we vet cleaners" (your trust story is content gold). Post on Instagram, TikTok, WhatsApp Status.
- **The vetting story is your hook.** "Here's how we check every cleaner before they enter your home" directly attacks the #1 fear of letting a stranger into your house. No competitor leans on this hard enough.

### 11.2 Launch (Week 9): one zone, concentrated

- **Launch offer** for the waitlist — a first-clean discount, time-limited. Scarcity + your warm list converts.
- **Estate and community penetration** — Lekki/Ajah estates have WhatsApp/Facebook groups and noticeboards. Get into a few; one happy estate seeds dozens of bookings via word of mouth.
- **Referral by hand** (not an automated system yet — that's V2): personally offer early customers a discount for referring a neighbour. Track it in a spreadsheet.

### 11.3 Post-launch growth

- **Double down on what converts.** If Instagram reels drive bookings, make more. If estate groups do, get into more estates.
- **Paid ads only after organic + referral prove the unit economics.** Meta/Instagram ads geo-targeted to your zone, retargeting waitlist and site visitors. Don't burn cash on ads before you know your conversion and repeat rates.
- **Reviews flywheel** — after every clean, ask for a rating in the SMS; surface ratings on cleaner profiles; use top testimonials in ads.

### 11.4 Positioning against competitors

- **vs Shaaré:** you fix their known problems — load-balanced matching (not the same overworked cleaner every time), honest availability (no booking into a void), fast confirmation. Don't name them in marketing; just be visibly better at the things they're known to fumble.
- **vs Eden Life:** they're broad home-services; you're the cleaning specialist. "We do one thing and we do it properly."
- **vs SweepSouth:** they're the well-funded incomer. You win on local supply quality and being built for Lagos from the ground up. Speed and local trust beat scale early.

_(Worth a fresh chat to verify each competitor's current pricing, coverage, and status before you finalise positioning — that landscape shifts.)_

---

## 12. Cleaner payout system

> **Status as of June 2026:** Fully built and live. DB schema, admin payout screen, earnings ledger, and Paystack Transfer integration are all in production. Paystack Transfers requires one-time CAC/BVN activation on your dashboard — until then, use "Mark paid manually".

### 12.1 How cleaners earn

- Every booking that reaches `completed` status generates one `cleaner_earnings` row.
- **Earning = 78% of the cleaning fee** — meaning `base_amount_kobo + addons_amount_kobo` only. Insurance (₦1,300 flat) is 100% retained by Klova and never goes into cleaner earnings.
- Formula: `earning_kobo = (base + addons) - round((base + addons) × 0.22)`

### 12.2 Payout cadence

- **Weekly, every Friday.** The founder opens `/admin/payouts`, reviews the table of cleaners with unpaid earnings, and runs the batch.
- Cleaners can expect payment by Friday evening for all jobs completed before Friday morning.
- If a cleaner has no `cleaner_bank_accounts` row, they appear in the payout table with a warning — pay them cash until their account is added in the Cleaners manager.

### 12.3 Database tables

| Table | Purpose |
|---|---|
| `cleaner_bank_accounts` | One row per cleaner — 10-digit NUBAN, bank code, account name. Paystack recipient code stored here once created. |
| `cleaner_earnings` | One row per completed booking — `earning_kobo`, `status` (`unpaid → scheduled → paid`), FK to `cleaner_payouts`. |
| `cleaner_payouts` | One row per weekly batch entry — `total_kobo`, `method` (`paystack` or `manual`), Paystack transfer codes, `status`. |

### 12.4 Paystack Transfer API setup (do once)

1. Log into your Paystack dashboard → Settings → Transfers.
2. Complete the BVN + CAC verification (required by CBN for disbursements).
3. Ensure your Paystack balance has enough to cover the week's payout batch. Your 22% commission goes into the Paystack balance each time a booking is confirmed — that's the pool you pay cleaners from.
4. No code changes needed. `PAYSTACK_SECRET_KEY` is already set in Railway (Express API) and must also be added to Vercel (Next.js) for the admin payout route to call Paystack directly.

**To add `PAYSTACK_SECRET_KEY` to Vercel:** Vercel dashboard → Klova project → Settings → Environment Variables → add `PAYSTACK_SECRET_KEY` with your live secret key.

### 12.5 Paystack bulk transfer endpoint

The admin payout screen calls Paystack `POST /transfer/bulk` — one API call, one entry per cleaner, each with their own `recipient_code` and `amount` in kobo. Every cleaner gets their exact earned amount simultaneously.

Paystack fires `transfer.success`, `transfer.failed`, or `transfer.reversed` webhooks as transfers settle. The webhook handler in `api/src/controllers/webhookController.ts` handles all three events and updates the `cleaner_payouts` and `cleaner_earnings` rows accordingly.

### 12.6 Admin workflow (weekly Friday SOP)

1. Open `/admin/payouts`.
2. Review the "Unpaid earnings" table — check each cleaner has a bank account on file.
3. Click **"Send via Paystack"** per cleaner (or wait for "Mark paid manually" fallback if Paystack Transfers isn't activated yet).
4. Watch the status badges update as Paystack webhooks arrive (refresh the page).
5. Any `failed` transfers: fix the bank account details in Cleaners and retry next week.

### 12.7 Earnings auto-recording

An earnings row is inserted via two paths:
- **Admin "Mark complete"** button on a booking (`POST /api/admin/bookings/[id]/complete`) — earns immediately on click.
- **Nightly auto-complete cron** (if built) — would call the same logic for bookings past their date that are still `confirmed`.

Currently there is no auto-complete cron; admin manually marks bookings complete after confirmation that the job was done.

---

## 13. Ready-to-paste prompts for your spin-off chats

Each of these starts a focused deep-dive. Paste the project context first, then one of these.

1. **Database setup:** "Using the schema in our master roadmap, give me the exact Supabase SQL to run, plus the row-level security policies I need so customers can't read other customers' data and only my admin login can touch the cleaners and availability tables."

2. **Matching algorithm:** "Write the full Node.js/Express implementation of our matching algorithm including the transaction with row locking so two bookings can't grab the same cleaner. Include the no-match path and the recent-jobs load-balancing query."

3. **Paystack integration:** "Walk me through the complete Paystack flow in Express — initialise transaction, the webhook with signature verification, triggering the match on charge.success, and the refund path on no-match. Give me the actual code."

4. **Booking flow frontend:** "Build the Next.js + Tailwind booking flow from our roadmap, mobile-first, with the live price calculator wired to my pricing tables. One screen at a time, starting with zone + service selection."

5. **Cleaner profile + confirmation screens:** "Build the cleaner profile card and the booking confirmation screen in Next.js + Tailwind, using the fields in our schema. Include the verified badge and rating display."

6. **Admin panel:** "Build my admin dashboard in Next.js — bookings list with filters, match override, cleaner CRUD, the weekly availability editor, and the revenue summary. Behind Supabase auth, my login only."

7. **No-availability handling:** "Build the no-match experience end to end — backend logic to find alternative available dates in the zone, plus the frontend screen that offers them instead of a dead end."

8. **Cleaner recruitment kit:** "Expand the recruitment section into a full kit: refined job posts for each channel, a printable interview scorecard, the one-page conduct agreement, and a WhatsApp script for triaging applicants."

9. **Marketing launch plan:** "Build my Week 6–10 marketing calendar — exact content pieces, posting schedule, the waitlist page copy, the launch offer, and the estate-group outreach scripts."

10. **Pitch prep (later):** "Using the metrics in our roadmap, build the investor narrative and the data points I need to hit before raising, plus what a first deck should contain."

---

## 13. The honest tradeoffs

- **Solo + learning to code means slow.** The 8–10 week timeline assumes steady progress, not full-time velocity. The fix isn't to rush the build — it's to keep Track B (cleaners, demand) moving so that the day the software is ready, you have supply and customers waiting.
- **Manual dispatch doesn't scale — and that's fine.** You being the dispatch layer in V1 is a feature, not a bug: it keeps quality high and teaches you exactly where to automate in V2. It breaks somewhere around 30–50 bookings a week. Cross that bridge when the volume demands it.
- **Supply is the constraint, not demand.** Lagos has no shortage of people who want reliable cleaning. It has a shortage of _trustworthy, vetted, reliable_ cleaners. Your no-match rate will tell you the truth. Over-invest in recruiting and retaining good cleaners.
- **Don't over-build.** Everything on your "won't build in V1" list is correctly deferred. The most common solo-founder failure is building features instead of getting 20 real bookings. Resist it.

---

_Next step: start Track A Week 0 (scaffold the stack) and Track B Week 0 (post the job, draft pricing) on the same day. Open a fresh chat with prompt #1 or #8 when you're ready to go deep._
