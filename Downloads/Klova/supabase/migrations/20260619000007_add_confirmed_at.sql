-- Add confirmed_at timestamp to bookings.
-- Set by the Paystack webhook when a booking transitions to 'confirmed'.
-- Used by the revenue screen's "Cash received" filter mode.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Backfill: for already-confirmed/completed bookings, use updated_at as the best
-- approximation of when the Paystack webhook ran.
UPDATE bookings
SET confirmed_at = updated_at
WHERE status IN ('confirmed', 'completed')
  AND confirmed_at IS NULL;
