-- Klova Row-Level Security
--
-- Architecture: the Express backend connects with the service role key,
-- which bypasses RLS entirely. The frontend never talks to Supabase directly.
-- Therefore: enable RLS on every table and add NO permissive policies for
-- anon or authenticated roles. Zero access from any Supabase client key.
-- The service role is the only path in, and it always goes through Express.

alter table zones               enable row level security;
alter table services            enable row level security;
alter table pricing             enable row level security;
alter table addons              enable row level security;
alter table cleaners            enable row level security;
alter table cleaner_availability enable row level security;
alter table customers           enable row level security;
alter table bookings            enable row level security;
alter table booking_addons      enable row level security;
alter table ratings             enable row level security;

-- No policies are added intentionally.
-- Postgres default with RLS enabled and no policies = DENY ALL
-- for the anon and authenticated roles.
-- The service role key (used only in api/src/lib/supabase.ts) bypasses
-- RLS by design and retains full read/write access to every table.
