-- Audit trail for every keeper location change.
-- Records old/new coordinates, who made the change, and when.
-- Location changes do NOT retroactively affect already-matched bookings —
-- transport fares are stored in booking_cleaners.transport_fare_kobo at
-- match time and are never re-derived from cleaner coordinates after that.
CREATE TABLE IF NOT EXISTS cleaner_location_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id      UUID        NOT NULL REFERENCES cleaners(id) ON DELETE CASCADE,
  old_latitude    DOUBLE PRECISION,
  old_longitude   DOUBLE PRECISION,
  new_latitude    DOUBLE PRECISION,
  new_longitude   DOUBLE PRECISION,
  changed_by_role TEXT        NOT NULL CHECK (changed_by_role IN ('admin', 'keeper')),
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON cleaner_location_log (cleaner_id, changed_at DESC);
