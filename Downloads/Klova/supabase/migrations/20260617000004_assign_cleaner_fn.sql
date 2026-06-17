-- assign_cleaner: atomic cleaner selection with row-level locking.
--
-- Called from the Node.js payment webhook after matchCleaner() produces
-- an ordered candidate list. Iterates the list, attempts SELECT FOR UPDATE
-- on each availability row, and claims the first one still free.
--
-- Concurrency guarantee (PostgreSQL READ COMMITTED):
--   When two transactions race on the same candidate row, the second waits.
--   After the first commits (is_booked → true), the second re-evaluates the
--   WHERE clause and finds the row gone — it moves to the next candidate.
--   This means exactly one transaction wins per (cleaner, date) slot.
--
-- Returns:
--   'matched:<cleaner_uuid>'  — booking assigned
--   'no_match'               — all candidates exhausted; booking set to no_match

CREATE OR REPLACE FUNCTION public.assign_cleaner(
  p_booking_id    UUID,
  p_candidate_ids UUID[],
  p_booking_date  DATE
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_candidate UUID;
  v_avail_id  UUID;
BEGIN
  FOREACH v_candidate IN ARRAY COALESCE(p_candidate_ids, ARRAY[]::UUID[]) LOOP
    -- Lock the row; block if another transaction holds it.
    -- At READ COMMITTED, after the wait, the WHERE clause is re-checked against
    -- the committed state — a row that became is_booked=true will not be returned.
    SELECT id INTO v_avail_id
      FROM public.cleaner_availability
     WHERE cleaner_id    = v_candidate
       AND available_date = p_booking_date
       AND is_booked      = false
     FOR UPDATE;

    IF v_avail_id IS NOT NULL THEN
      UPDATE public.cleaner_availability
         SET is_booked = true
       WHERE id = v_avail_id;

      UPDATE public.bookings
         SET cleaner_id  = v_candidate,
             status      = 'matched',
             updated_at  = NOW()
       WHERE id = p_booking_id;

      RETURN 'matched:' || v_candidate::text;
    END IF;
    -- Row was claimed while we waited — try the next candidate.
  END LOOP;

  -- No candidate was available; record the outcome.
  UPDATE public.bookings
     SET status     = 'no_match',
         updated_at = NOW()
   WHERE id = p_booking_id;

  RETURN 'no_match';
END;
$$;

-- Only the service role (backend) may call this function.
REVOKE EXECUTE ON FUNCTION public.assign_cleaner(UUID, UUID[], DATE) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.assign_cleaner(UUID, UUID[], DATE) TO service_role;
