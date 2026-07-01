-- Reconcile dual-ledger: make cleaner_earnings the single source of truth.
--
-- Background: bookings.keeper_paid_out and cleaner_earnings.status are two
-- separate accounting tracks that were never kept in sync. The mark-paid admin
-- route flipped keeper_paid_out = true but never touched cleaner_earnings,
-- leaving earnings rows as 'unpaid' even for already-paid-out bookings.
--
-- This migration:
--   1. Settles cleaner_earnings rows whose booking was already paid out
--      (keeper_paid_out = true) but whose status is still 'unpaid'/'scheduled'/'failed'.
--   2. Settles booking_cleaners.paid_out for transport rows on those same bookings.
--   3. Verifies no booking remains both keeper_paid_out=true AND has an unpaid
--      earning row — rolls back the whole transaction if the check fails.
--   4. Marks keeper_paid_out as DEPRECATED via a column comment.
--      The column is NOT dropped here; it stays as a read-only audit flag until
--      all application reads are removed (tracked separately).
--
-- After this migration new code must NOT write to bookings.keeper_paid_out.
-- Drop it once the reads in payouts/bookings/route.ts are removed.

DO $$
DECLARE
  v_earnings_reconciled  BIGINT := 0;
  v_transport_reconciled BIGINT := 0;
  v_inconsistent         BIGINT := 0;
BEGIN

  -- ── 1. Settle cleaner_earnings ─────────────────────────────────────────────
  -- For every booking that was already manually paid out, mark any earnings
  -- that slipped through as 'paid'. Rows already 'paid' or 'refunded' are
  -- untouched (NOT IN guard).
  UPDATE cleaner_earnings
  SET    status = 'paid'
  WHERE  booking_id IN (
           SELECT id FROM bookings WHERE keeper_paid_out = true
         )
  AND    status NOT IN ('paid', 'refunded');

  GET DIAGNOSTICS v_earnings_reconciled = ROW_COUNT;

  -- ── 2. Settle booking_cleaners transport rows ──────────────────────────────
  -- For the same set of paid-out bookings, mark any transport reimbursement
  -- rows that are still unsettled. Only rows with an actual fare are touched;
  -- rows with NULL or 0 transport_fare_kobo are irrelevant to payouts.
  UPDATE booking_cleaners
  SET    paid_out = true
  WHERE  booking_id IN (
           SELECT id FROM bookings WHERE keeper_paid_out = true
         )
  AND    paid_out = false
  AND    (transport_fare_kobo IS NOT NULL AND transport_fare_kobo > 0);

  GET DIAGNOSTICS v_transport_reconciled = ROW_COUNT;

  -- ── 3. Verification ────────────────────────────────────────────────────────
  -- After the updates above, no booking should be simultaneously
  -- keeper_paid_out=true and have a cleaner_earnings row still 'unpaid'.
  -- If any such row exists the migration rolls back entirely.
  SELECT COUNT(*) INTO v_inconsistent
  FROM   cleaner_earnings ce
  JOIN   bookings b ON b.id = ce.booking_id
  WHERE  b.keeper_paid_out = true
  AND    ce.status = 'unpaid';

  IF v_inconsistent > 0 THEN
    RAISE EXCEPTION
      'Reconciliation verification failed: % cleaner_earnings rows still unpaid '
      'for bookings where keeper_paid_out = true. Rolling back.',
      v_inconsistent;
  END IF;

  RAISE NOTICE 'keeper_paid_out reconciliation complete:';
  RAISE NOTICE '  cleaner_earnings rows settled : %', v_earnings_reconciled;
  RAISE NOTICE '  booking_cleaners rows settled  : %', v_transport_reconciled;
  RAISE NOTICE '  verification passed            : 0 unpaid rows remain for paid-out bookings';

END $$;

-- ── 4. Deprecate the column ────────────────────────────────────────────────────
-- Reads are still present in payouts/bookings/route.ts and will be removed in
-- the next application deployment. The column itself is dropped only after that.
COMMENT ON COLUMN bookings.keeper_paid_out IS
  'DEPRECATED 2026-07-01. Do not write. '
  'cleaner_earnings.status is now the authoritative settled-state flag. '
  'Drop this column after all application reads are removed.';
