-- Extend assign_cleaner to support keeper_count=2 with all-or-nothing locking.
--
-- Strategy
-- --------
-- Walk the ranked candidate list, lock each cleaner_availability row with
-- SELECT FOR UPDATE (waits on contention, re-evaluates is_booked at READ COMMITTED).
-- Collect locks WITHOUT writing until we have a full set of keeper_count slots.
-- Only then flush all writes atomically: mark slots booked, insert booking_cleaners
-- rows, and update the booking row.
--
-- If the candidate list is exhausted before a full set is found, no writes are
-- committed — row locks are released when the calling transaction ends, and the
-- booking is set to 'no_match'.
--
-- Backward compatibility
-- ----------------------
-- p_keeper_count defaults to 1. The Node.js caller currently omits it.
-- For keeper_count=1 the return value is 'matched:<uuid>' — identical to the
-- old 3-argument RPC so no Node.js changes are needed in this prompt.
-- For keeper_count=2 it returns 'matched:<uuid_lead>,<uuid_second>'.
--
-- bookings.cleaner_id is still written (lead cleaner) so the slot-expiry cron
-- and all existing code reading that column continue to work unchanged.

-- ─── Drop old 3-arg signature ─────────────────────────────────────────────────
-- CREATE OR REPLACE would create a second overloaded function rather than
-- replacing the old one because the parameter list differs. Drop explicitly
-- so only one signature exists and PostgREST can resolve named-param calls.

DROP FUNCTION IF EXISTS public.assign_cleaner(UUID, UUID[], DATE);

-- ─── New function ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.assign_cleaner(
  p_booking_id    UUID,
  p_candidate_ids UUID[],
  p_booking_date  DATE,
  p_keeper_count  INT  DEFAULT 1
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_candidate   UUID;
  v_avail_id    UUID;
  v_avail_ids   UUID[] := '{}';    -- availability row IDs locked so far
  v_cleaner_ids UUID[] := '{}';    -- corresponding cleaner IDs, in pick order
  v_roles       TEXT[] := ARRAY['lead', 'second'];
  v_i           INT;
BEGIN
  -- ── Phase 1: collect locks without writing ──────────────────────────────────
  --
  -- Walk the ranked list. For each candidate that still has a free slot,
  -- lock its availability row and record it. Stop once we have keeper_count
  -- locks. Any candidate whose row is already locked by a concurrent
  -- transaction is waited on; after the wait, the re-evaluated WHERE clause
  -- drops it if it became is_booked=true in the meantime.

  FOREACH v_candidate IN ARRAY COALESCE(p_candidate_ids, ARRAY[]::UUID[]) LOOP
    -- Guard: skip if this cleaner is already in our set (shouldn't happen with
    -- a properly de-duped candidate list, but defensive is cheap here).
    CONTINUE WHEN v_candidate = ANY(v_cleaner_ids);

    SELECT id INTO v_avail_id
      FROM public.cleaner_availability
     WHERE cleaner_id    = v_candidate
       AND available_date = p_booking_date
       AND is_booked      = false
     FOR UPDATE;

    IF v_avail_id IS NOT NULL THEN
      v_avail_ids   := v_avail_ids   || v_avail_id;
      v_cleaner_ids := v_cleaner_ids || v_candidate;

      EXIT WHEN array_length(v_cleaner_ids, 1) = p_keeper_count;
    END IF;
  END LOOP;

  -- ── Phase 2: all-or-nothing guard ──────────────────────────────────────────
  --
  -- If we could not collect a full set, do not write anything.
  -- Row locks acquired above are released when this transaction ends.

  IF array_length(v_cleaner_ids, 1) IS NULL
  OR array_length(v_cleaner_ids, 1) < p_keeper_count THEN
    UPDATE public.bookings
       SET status     = 'no_match',
           updated_at = NOW()
     WHERE id = p_booking_id;

    RETURN 'no_match';
  END IF;

  -- ── Phase 3: flush all writes atomically ───────────────────────────────────
  --
  -- We hold every required lock — no other transaction can steal these rows.

  -- 3a. Mark every reserved slot as booked in one UPDATE
  UPDATE public.cleaner_availability
     SET is_booked = true
   WHERE id = ANY(v_avail_ids);

  -- 3b. Insert one booking_cleaners row per keeper (lead first, second second)
  FOR v_i IN 1 .. array_length(v_cleaner_ids, 1) LOOP
    INSERT INTO public.booking_cleaners (booking_id, cleaner_id, role)
    VALUES (p_booking_id, v_cleaner_ids[v_i], v_roles[v_i])
    ON CONFLICT (booking_id, cleaner_id) DO NOTHING;
  END LOOP;

  -- 3c. Update the booking:
  --     • cleaner_id  = lead cleaner UUID (backward-compat: slot-expiry cron,
  --                     existing reads, admin_reassign all use this column)
  --     • keeper_count = actual number reserved
  --     • status       = 'matched'
  UPDATE public.bookings
     SET cleaner_id   = v_cleaner_ids[1],
         keeper_count = p_keeper_count,
         status       = 'matched',
         updated_at   = NOW()
   WHERE id = p_booking_id;

  -- ── Return ─────────────────────────────────────────────────────────────────
  --
  -- keeper_count=1  → 'matched:<uuid>'          (identical to old RPC)
  -- keeper_count=2  → 'matched:<uuid1>,<uuid2>'
  RETURN 'matched:' || array_to_string(v_cleaner_ids, ',');
END;
$$;

-- Permissions on the new signature
REVOKE EXECUTE ON FUNCTION public.assign_cleaner(UUID, UUID[], DATE, INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.assign_cleaner(UUID, UUID[], DATE, INT) TO service_role;
