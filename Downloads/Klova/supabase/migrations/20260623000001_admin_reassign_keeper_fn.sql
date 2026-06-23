-- admin_reassign_keeper: role-aware atomic keeper swap for 1 or 2-keeper bookings.
--
-- Supersedes admin_reassign_cleaner for all admin reassign operations.
-- The old function is left in place (different signature) for backward compatibility
-- until all callers are updated.
--
-- Concurrency guarantee: same SELECT FOR UPDATE pattern as assign_cleaner.
-- Raises:
--   'duplicate_keeper'   — new cleaner is already in the OTHER slot on this booking
--   'cleaner_unavailable' — new cleaner's slot was taken since listing

CREATE OR REPLACE FUNCTION public.admin_reassign_keeper(
  p_booking_id     UUID,
  p_role           TEXT,      -- 'lead' or 'second'
  p_new_cleaner_id UUID,
  p_booking_date   DATE
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_cleaner_id   UUID;
  v_other_cleaner_id UUID;
  v_bc_row_id        UUID;
  v_old_avail_id     UUID;
  v_new_avail_id     UUID;
  v_other_role       TEXT;
BEGIN
  -- ── 1. Lock and read the booking_cleaners row for this role ──────────────────
  SELECT id, cleaner_id
    INTO v_bc_row_id, v_old_cleaner_id
    FROM public.booking_cleaners
   WHERE booking_id = p_booking_id
     AND role       = p_role
   FOR UPDATE;

  -- ── 2. Guard: prevent assigning a cleaner already in the other slot ──────────
  v_other_role := CASE WHEN p_role = 'lead' THEN 'second' ELSE 'lead' END;

  SELECT cleaner_id
    INTO v_other_cleaner_id
    FROM public.booking_cleaners
   WHERE booking_id = p_booking_id
     AND role       = v_other_role;

  IF v_other_cleaner_id IS NOT NULL AND v_other_cleaner_id = p_new_cleaner_id THEN
    RAISE EXCEPTION 'duplicate_keeper'
      USING HINT = 'The new keeper is already assigned to the other slot on this booking';
  END IF;

  -- ── 3. Free the old cleaner's availability slot ──────────────────────────────
  IF v_old_cleaner_id IS NOT NULL AND v_old_cleaner_id <> p_new_cleaner_id THEN
    SELECT id
      INTO v_old_avail_id
      FROM public.cleaner_availability
     WHERE cleaner_id    = v_old_cleaner_id
       AND available_date = p_booking_date
       AND is_booked      = true
     FOR UPDATE;

    IF v_old_avail_id IS NOT NULL THEN
      UPDATE public.cleaner_availability
         SET is_booked = false
       WHERE id = v_old_avail_id;
    END IF;
  END IF;

  -- ── 4. Claim the new cleaner's availability slot ─────────────────────────────
  SELECT id
    INTO v_new_avail_id
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

  -- ── 5. Update booking_cleaners ───────────────────────────────────────────────
  IF v_bc_row_id IS NOT NULL THEN
    UPDATE public.booking_cleaners
       SET cleaner_id = p_new_cleaner_id
     WHERE id         = v_bc_row_id;
  ELSE
    -- Edge case: no existing row for this role (shouldn't happen in normal flow)
    INSERT INTO public.booking_cleaners (booking_id, cleaner_id, role)
    VALUES (p_booking_id, p_new_cleaner_id, p_role);
  END IF;

  -- ── 6. Keep bookings.cleaner_id in sync for the lead role ───────────────────
  --    (backward-compat column read by slot-expiry cron and other existing code)
  IF p_role = 'lead' THEN
    UPDATE public.bookings
       SET cleaner_id = p_new_cleaner_id,
           status     = CASE WHEN status = 'no_match' THEN 'matched' ELSE status END,
           updated_at = NOW()
     WHERE id = p_booking_id;
  ELSE
    UPDATE public.bookings
       SET updated_at = NOW()
     WHERE id = p_booking_id;
  END IF;

  RETURN 'reassigned:' || p_role || ':' || p_new_cleaner_id::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reassign_keeper(UUID, TEXT, UUID, DATE) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_reassign_keeper(UUID, TEXT, UUID, DATE) TO service_role;
