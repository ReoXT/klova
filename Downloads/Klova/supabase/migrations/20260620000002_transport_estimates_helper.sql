-- Transport fare hint system
--
-- Provides a suggested (advisory) fare for a Keeper's trip from their home
-- sub-zone to the customer's sub-zone. This is a sanity-check only — the
-- admin still confirms the real fare before it is stored on the booking.
--
-- UNITS: suggested_fare and transport_fare (bookings) are both NUMERIC NGN,
-- not kobo integers. Transport fares are manually quoted and do not flow
-- through the kobo price engine.
--
-- SYMMETRY: get_transport_suggestion() tries both (keeper→customer) and
-- (customer→keeper) so seed data only needs one row per corridor.
-- Do NOT seed both directions — it creates redundancy and the function
-- returns an arbitrary row if both exist.


-- ─── transport_estimates ─────────────────────────────────────────────────────

CREATE TABLE transport_estimates (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_area      TEXT        NOT NULL,
  to_area        TEXT        NOT NULL,
  suggested_fare NUMERIC     NOT NULL CHECK (suggested_fare >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_area, to_area)
);

ALTER TABLE transport_estimates ENABLE ROW LEVEL SECURITY;
-- No policies: service role bypasses RLS; anon key has zero access (project pattern).


-- ─── cleaners.home_area ──────────────────────────────────────────────────────

-- Optional sub-zone label matching the areas used in transport_estimates.
-- When set, the admin panel can call get_transport_suggestion() automatically.
ALTER TABLE cleaners
  ADD COLUMN IF NOT EXISTS home_area TEXT;


-- ─── get_transport_suggestion ─────────────────────────────────────────────────
-- Returns the suggested NGN fare for a Keeper/customer area pair, or NULL if
-- no estimate exists. Lookup is case-insensitive and direction-agnostic.
-- Returns NULL when either argument is NULL (no home_area set on cleaner).

CREATE OR REPLACE FUNCTION get_transport_suggestion(
  p_keeper_area   TEXT,
  p_customer_area TEXT
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
  SELECT suggested_fare
  FROM   transport_estimates
  WHERE  (LOWER(from_area) = LOWER(p_keeper_area)   AND LOWER(to_area) = LOWER(p_customer_area))
      OR (LOWER(from_area) = LOWER(p_customer_area) AND LOWER(to_area) = LOWER(p_keeper_area))
  LIMIT  1;
$$;


-- ─── seed: Lekki/Ajah corridors ──────────────────────────────────────────────
-- ~17 common corridors. One row per corridor (function is symmetric).
-- Fares are approximate 2025 NGN values for keke/bus; round numbers are
-- intentional — these are hints, not contracts.

INSERT INTO transport_estimates (from_area, to_area, suggested_fare) VALUES
  ('Lekki Phase 1', 'Ikate',          800),
  ('Lekki Phase 1', 'Chevron',       1500),
  ('Lekki Phase 1', 'VGC',           2000),
  ('Lekki Phase 1', 'Jakande',       1200),
  ('Lekki Phase 1', 'Ajah',          3000),
  ('Lekki Phase 1', 'Sangotedo',     3500),
  ('Ikate',         'Chevron',       1000),
  ('Ikate',         'Ajah',          2500),
  ('Chevron',       'Agungi',         700),
  ('Chevron',       'VGC',           1000),
  ('Chevron',       'Ajah',          2000),
  ('Chevron',       'Sangotedo',     2500),
  ('VGC',           'Ajah',          1500),
  ('VGC',           'Sangotedo',     2000),
  ('Ajah',          'Badore',         800),
  ('Ajah',          'Sangotedo',     1000),
  ('Ajah',          'Ogombo',         800),
  ('Sangotedo',     'Ogombo',         700);
