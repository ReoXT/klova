-- Two-keeper support: keeper_count on bookings + booking_cleaners join table.
--
-- Existing single-cleaner bookings are fully preserved:
--   • bookings.cleaner_id is untouched (downstream code still reads it until cut-over)
--   • Every booking that already has a cleaner_id gets keeper_count=1 and one
--     booking_cleaners row with role='lead'
--   • Bookings without a cleaner_id (pending_payment, no_match) keep keeper_count=1
--     and get no booking_cleaners row — correct, they have no assigned keeper yet
--
-- transport_fare (NGN NUMERIC on bookings) is converted to kobo (× 100) for
-- booking_cleaners.transport_fare_kobo (BIGINT) to stay consistent with all
-- other money columns in this codebase.

-- ─── 1. keeper_count on bookings ──────────────────────────────────────────────

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS keeper_count INT NOT NULL DEFAULT 1
    CHECK (keeper_count IN (1, 2));

-- ─── 2. booking_cleaners join table ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS booking_cleaners (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id          UUID    NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  cleaner_id          UUID    NOT NULL REFERENCES cleaners(id),
  role                TEXT    NOT NULL DEFAULT 'lead'
                                CHECK (role IN ('lead', 'second')),
  transport_fare_kobo BIGINT,                     -- per-keeper reimbursement, kobo
  paid_out            BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- same cleaner cannot fill both the lead AND second slot on one booking
  UNIQUE (booking_id, cleaner_id)
);

-- fast lookup by booking (primary access pattern)
CREATE INDEX IF NOT EXISTS idx_booking_cleaners_booking_id
  ON booking_cleaners (booking_id);

-- fast lookup by cleaner (admin dashboard, payout queries)
CREATE INDEX IF NOT EXISTS idx_booking_cleaners_cleaner_id
  ON booking_cleaners (cleaner_id);

-- service role bypasses RLS; anon/authenticated get DENY ALL (no policies added)
ALTER TABLE booking_cleaners ENABLE ROW LEVEL SECURITY;

-- ─── 3. Backfill from existing bookings.cleaner_id ────────────────────────────
--
-- For every booking that already has a cleaner_id, insert one lead row.
-- transport_fare (NGN) is multiplied by 100 to produce kobo.
-- keeper_paid_out maps directly to paid_out.
-- ON CONFLICT DO NOTHING makes the statement safe to re-run.

INSERT INTO booking_cleaners (booking_id, cleaner_id, role, transport_fare_kobo, paid_out)
SELECT
  b.id                                                           AS booking_id,
  b.cleaner_id,
  'lead'                                                         AS role,
  CASE
    WHEN b.transport_fare IS NOT NULL
    THEN ROUND(b.transport_fare * 100)::BIGINT
    ELSE NULL
  END                                                            AS transport_fare_kobo,
  b.keeper_paid_out                                              AS paid_out
FROM bookings b
WHERE b.cleaner_id IS NOT NULL
ON CONFLICT (booking_id, cleaner_id) DO NOTHING;

-- ─── 4. Verify the backfill is 1-for-1 ───────────────────────────────────────
--
-- Counts must match exactly. If they diverge, the migration raises an exception
-- and the whole transaction rolls back — leaving the DB untouched.

DO $verify$
DECLARE
  v_bookings_with_cleaner BIGINT;
  v_booking_cleaner_rows  BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_bookings_with_cleaner
    FROM bookings
   WHERE cleaner_id IS NOT NULL;

  SELECT COUNT(*) INTO v_booking_cleaner_rows
    FROM booking_cleaners;

  IF v_bookings_with_cleaner <> v_booking_cleaner_rows THEN
    RAISE EXCEPTION
      'booking_cleaners backfill mismatch: % bookings have cleaner_id but % rows in booking_cleaners',
      v_bookings_with_cleaner, v_booking_cleaner_rows;
  END IF;

  RAISE NOTICE
    'Two-keeper migration OK — % booking_cleaners row(s), all existing bookings preserved',
    v_booking_cleaner_rows;
END;
$verify$;
