ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS transport_estimate_kobo BIGINT;
