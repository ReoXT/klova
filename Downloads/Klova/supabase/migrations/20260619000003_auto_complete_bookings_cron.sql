-- Function: mark confirmed bookings as completed once their date has passed
CREATE OR REPLACE FUNCTION public.auto_complete_past_bookings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE bookings
  SET status     = 'completed',
      updated_at = NOW()
  WHERE status      = 'confirmed'
    AND booking_date < CURRENT_DATE;
END;
$$;

-- Schedule: run daily at 23:00 UTC = midnight Lagos time (WAT = UTC+1)
SELECT cron.schedule(
  'auto-complete-past-bookings',
  '0 23 * * *',
  'SELECT public.auto_complete_past_bookings()'
);
