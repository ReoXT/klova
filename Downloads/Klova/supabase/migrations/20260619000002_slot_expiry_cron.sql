-- Enable pg_cron (no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function: release cleaner slots from matched bookings that expired unpaid
CREATE OR REPLACE FUNCTION public.release_expired_matched_bookings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Free the cleaner availability slots first
  UPDATE cleaner_availability ca
  SET is_booked = false
  FROM bookings b
  WHERE b.cleaner_id   = ca.cleaner_id
    AND b.booking_date = ca.available_date
    AND b.status       = 'matched'
    AND b.updated_at   < NOW() - INTERVAL '25 minutes';

  -- Then cancel those bookings
  UPDATE bookings
  SET status     = 'cancelled',
      updated_at = NOW()
  WHERE status     = 'matched'
    AND updated_at < NOW() - INTERVAL '25 minutes';
END;
$$;

-- Schedule: run every 5 minutes
-- (slots are guaranteed to be released within 5 min of the 25-min mark)
SELECT cron.schedule(
  'release-expired-matched-slots',
  '*/5 * * * *',
  'SELECT public.release_expired_matched_bookings()'
);
