-- Klova schema migration
-- Creates all core tables with constraints

-- ─── zones ───────────────────────────────────────────────────────────────────
create table zones (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  is_active   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ─── services ────────────────────────────────────────────────────────────────
create table services (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);

-- ─── pricing ─────────────────────────────────────────────────────────────────
create table pricing (
  id           uuid primary key default gen_random_uuid(),
  service_id   uuid not null references services(id),
  bedrooms     text not null check (bedrooms in ('1', '2', '3', '4+')),
  amount_kobo  integer not null check (amount_kobo > 0),
  created_at   timestamptz not null default now(),
  unique (service_id, bedrooms)
);

-- ─── addons ──────────────────────────────────────────────────────────────────
create table addons (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  amount_kobo integer not null check (amount_kobo > 0),
  created_at  timestamptz not null default now()
);

-- ─── cleaners ────────────────────────────────────────────────────────────────
create table cleaners (
  id           uuid primary key default gen_random_uuid(),
  first_name   text not null,
  last_name    text not null,
  phone        text not null unique,
  photo_url    text,
  zone_id      uuid not null references zones(id),
  status       text not null default 'active'
                 check (status in ('active', 'inactive', 'suspended')),
  nin_verified boolean not null default false,
  rating       numeric(3,2) check (rating >= 1 and rating <= 5),
  total_jobs   integer not null default 0 check (total_jobs >= 0),
  created_at   timestamptz not null default now()
);

-- ─── cleaner_availability ────────────────────────────────────────────────────
create table cleaner_availability (
  id             uuid primary key default gen_random_uuid(),
  cleaner_id     uuid not null references cleaners(id) on delete cascade,
  available_date date not null,
  is_booked      boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (cleaner_id, available_date)
);

-- ─── customers ───────────────────────────────────────────────────────────────
create table customers (
  id         uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name  text not null,
  phone      text not null unique,
  email      text,
  created_at timestamptz not null default now()
);

-- ─── bookings ────────────────────────────────────────────────────────────────
create table bookings (
  id                   uuid primary key default gen_random_uuid(),
  customer_id          uuid not null references customers(id),
  cleaner_id           uuid references cleaners(id),
  requested_cleaner_id uuid references cleaners(id),
  zone_id              uuid not null references zones(id),
  service_id           uuid not null references services(id),
  bedrooms             text not null check (bedrooms in ('1', '2', '3', '4+')),
  booking_date         date not null,
  address              text not null,
  total_amount_kobo    integer not null check (total_amount_kobo > 0),
  commission_kobo      integer not null check (commission_kobo > 0),
  status               text not null default 'pending_payment'
                         check (status in (
                           'pending_payment',
                           'paid',
                           'matched',
                           'confirmed',
                           'completed',
                           'cancelled',
                           'no_match'
                         )),
  paystack_reference   text unique,
  refunded_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- keep updated_at current automatically
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger bookings_updated_at
  before update on bookings
  for each row execute function set_updated_at();

-- ─── booking_addons ───────────────────────────────────────────────────────────
create table booking_addons (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  addon_id   uuid not null references addons(id),
  unique (booking_id, addon_id)
);

-- ─── ratings ─────────────────────────────────────────────────────────────────
create table ratings (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null unique references bookings(id),
  customer_id uuid not null references customers(id),
  cleaner_id  uuid not null references cleaners(id),
  score       integer not null check (score >= 1 and score <= 5),
  comment     text,
  created_at  timestamptz not null default now()
);

-- ─── indexes ─────────────────────────────────────────────────────────────────
create index on cleaners (zone_id, status);
create index on cleaner_availability (available_date, is_booked);
create index on bookings (customer_id);
create index on bookings (cleaner_id);
create index on bookings (status);
create index on bookings (booking_date);
create index on ratings (cleaner_id);
