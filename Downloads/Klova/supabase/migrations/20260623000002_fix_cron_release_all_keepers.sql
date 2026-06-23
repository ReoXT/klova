-- Fix release_expired_matched_bookings to free ALL keeper slots.
--
-- Prior version joined only on bookings.cleaner_id (the lead keeper's column),
-- leaving the second keeper's availability slot permanently blocked after a
-- payment timeout on a 2-keeper booking.
--
-- New version checks BOTH the legacy bookings.cleaner_id column AND any rows
-- in booking_cleaners, so both slots are freed atomically in a single UPDATE.
-- The OR predicate is short-circuit-safe: any matched availability row that
-- satisfies either condition is freed.

CREATE OR REPLACE FUNCTION public.release_expired_matched_bookings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- ── Step 1: Free ALL keeper availability slots for expired matched bookings ──
  --
  -- Matches via booking_cleaners (covers lead + second for 2-keeper bookings)
  -- OR via bookings.cleaner_id (backward-compat for rows pre-dating booking_cleaners).
  -- Both join on b.booking_date = ca.available_date to scope to the right date.

  UPDATE cleaner_availability ca
  SET is_booked = false
  WHERE ca.is_booked = true
    AND EXISTS (
      SELECT 1
      FROM bookings b
      WHERE b.status       = 'matched'
        AND b.updated_at   < NOW() - INTERVAL '25 minutes'
        AND b.booking_date = ca.available_date
        AND (
          -- Lead keeper via the legacy denormalised column
          b.cleaner_id = ca.cleaner_id
          OR
          -- Any keeper (lead or second) via booking_cleaners
          EXISTS (
            SELECT 1
            FROM booking_cleaners bc
            WHERE bc.booking_id = b.id
              AND bc.cleaner_id = ca.cleaner_id
          )
        )
    );

  -- ── Step 2: Cancel those bookings ──────────────────────────────────────────
  UPDATE bookings
  SET status     = 'cancelled',
      updated_at = NOW()
  WHERE status     = 'matched'
    AND updated_at < NOW() - INTERVAL '25 minutes';
END;
$$;
