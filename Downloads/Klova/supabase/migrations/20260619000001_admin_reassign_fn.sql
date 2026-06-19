-- admin_reassign_cleaner: atomically swaps a booking from one cleaner to another.
-- Frees the old cleaner's availability slot and claims the new one in a single transaction.
-- Raises exception 'cleaner_unavailable' if the new slot was taken since listing.
--
-- Concurrency guarantee: same SELECT FOR UPDATE pattern as assign_cleaner.
-- If two admin sessions race on the same new cleaner, the loser sees is_booked=true
-- after the wait and gets cleaner_unavailable — no double-booking possible.

CREATE OR REPLACE FUNCTION public.admin_reassign_cleaner(
  p_booking_id     UUID,
  p_old_cleaner_id UUID,   -- NULL if booking had no cleaner assigned
  p_new_cleaner_id UUID,
  p_booking_date   DATE
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_avail_id UUID;
  v_new_avail_id UUID;
BEGIN
  -- 1. Free the old cleaner's slot (if one exists)
  IF p_old_cleaner_id IS NOT NULL THEN
    SELECT id INTO v_old_avail_id
      FROM public.cleaner_availability
     WHERE cleaner_id    = p_old_cleaner_id
       AND available_date = p_booking_date
       AND is_booked      = true
     FOR UPDATE;

    IF v_old_avail_id IS NOT NULL THEN
      UPDATE public.cleaner_availability
         SET is_booked = false
       WHERE id = v_old_avail_id;
    END IF;
  END IF;

  -- 2. Claim the new cleaner's slot; block if another transaction holds it
  SELECT id INTO v_new_avail_id
    FROM public.cleaner_availability
   WHERE cleaner_id    = p_new_cleaner_id
     AND available_date = p_booking_date
     AND is_booked      = false
   FOR UPDATE;

  IF v_new_avail_id IS NULL THEN
    RAISE EXCEPTION 'cleaner_unavailable'
      USING HINT = 'Selected cleaner no longer available for this date';
  END IF;

  UPDATE public.cleaner_availability
     SET is_booked = true
   WHERE id = v_new_avail_id;

  -- 3. Update the booking; promote no_match → matched if a cleaner is now assigned
  UPDATE public.bookings
     SET cleaner_id  = p_new_cleaner_id,
         status      = CASE
                         WHEN status = 'no_match' THEN 'matched'
                         ELSE status
                       END,
         updated_at  = NOW()
   WHERE id = p_booking_id;

  RETURN 'reassigned:' || p_new_cleaner_id::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reassign_cleaner(UUID, UUID, UUID, DATE) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_reassign_cleaner(UUID, UUID, UUID, DATE) TO service_role;
