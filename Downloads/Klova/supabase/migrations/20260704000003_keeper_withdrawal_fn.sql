-- Atomic reservation for keeper on-demand withdrawals.
--
-- Withdrawals are ARBITRARY amounts (not whole-booking batches), so this does
-- NOT go through the admin batch-payout path. The money-safety-critical part
-- is here: the balance check and the reservation happen inside one function
-- call, serialized per keeper with a transaction-scoped advisory lock, so two
-- simultaneous requests can never both pass the check and overdraw.
--
-- "available" is recomputed here identically to the wallet balance model
-- (web/app/api/keeper/_wallet.ts getWalletSummary):
--   available = owed_earnings (cleaner_earnings 'unpaid')
--             + owed_transport (settled, unpaid, unlinked, positive fares)
--             − withdrawn/pending (this keeper's non-failed 'keeper' payouts)
--
-- On success it inserts a cleaner_payouts row (requested_by 'keeper',
-- status 'pending') which immediately counts against available for the next
-- caller. The Next.js route then initiates the Paystack transfer and moves the
-- row to 'processing'; on failure it marks the row 'failed', returning the
-- amount to available.
CREATE OR REPLACE FUNCTION keeper_request_withdrawal(
  p_cleaner_id  UUID,
  p_amount_kobo BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_owed_earnings   BIGINT;
  v_owed_transport  BIGINT;
  v_withdrawn       BIGINT;
  v_available       BIGINT;
  v_bank_account_id UUID;
  v_payout_id       UUID;
BEGIN
  -- Positive amounts only (no minimum).
  IF p_amount_kobo IS NULL OR p_amount_kobo <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;

  -- Serialize all withdrawal attempts for THIS keeper. Held until the
  -- function's transaction commits, so a concurrent call blocks here and
  -- only proceeds once the first caller's pending row is committed and
  -- visible — making the check-then-insert atomic against overdraw.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_cleaner_id::text, 0));

  -- Require a primary bank account on file.
  SELECT id INTO v_bank_account_id
  FROM cleaner_bank_accounts
  WHERE cleaner_id = p_cleaner_id AND is_primary = true
  LIMIT 1;

  IF v_bank_account_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_bank');
  END IF;

  SELECT COALESCE(SUM(earning_kobo), 0) INTO v_owed_earnings
  FROM cleaner_earnings
  WHERE cleaner_id = p_cleaner_id AND status = 'unpaid';

  SELECT COALESCE(SUM(bc.transport_fare_kobo), 0) INTO v_owed_transport
  FROM booking_cleaners bc
  JOIN bookings b ON b.id = bc.booking_id
  WHERE bc.cleaner_id = p_cleaner_id
    AND bc.paid_out = false
    AND bc.transport_payout_id IS NULL
    AND bc.transport_fare_kobo > 0
    AND b.transport_status = 'paid';

  SELECT COALESCE(SUM(COALESCE(amount_kobo, total_kobo)), 0) INTO v_withdrawn
  FROM cleaner_payouts
  WHERE cleaner_id = p_cleaner_id
    AND requested_by = 'keeper'
    AND status NOT IN ('failed', 'reversed');

  v_available := v_owed_earnings + v_owed_transport - v_withdrawn;

  IF p_amount_kobo > v_available THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient', 'available_kobo', v_available);
  END IF;

  -- Reserve: a pending 'keeper' payout counts against available immediately.
  INSERT INTO cleaner_payouts (
    cleaner_id, bank_account_id, total_kobo, amount_kobo, method, status, requested_by
  )
  VALUES (
    p_cleaner_id, v_bank_account_id, p_amount_kobo, p_amount_kobo, 'paystack', 'pending', 'keeper'
  )
  RETURNING id INTO v_payout_id;

  RETURN jsonb_build_object(
    'ok', true,
    'payout_id', v_payout_id,
    'bank_account_id', v_bank_account_id,
    'available_kobo', v_available
  );
END;
$$;
