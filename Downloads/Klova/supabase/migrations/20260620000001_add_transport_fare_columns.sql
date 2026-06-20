-- Transport fare support
--
-- transport_fare is a pass-through reimbursement paid directly to the Keeper.
-- It MUST NOT be included in commission_amount, total_amount_kobo, or any
-- gross-booking-value calculation — commission is already locked at booking
-- creation time from the clean price alone.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS transport_fare         NUMERIC,
  ADD COLUMN IF NOT EXISTS transport_status       TEXT NOT NULL DEFAULT 'pending_quote'
    CHECK (transport_status IN (
      'pending_quote',
      'awaiting_payment',
      'paid',
      'waived',
      'not_required'
    )),
  ADD COLUMN IF NOT EXISTS transport_payment_ref  TEXT,
  ADD COLUMN IF NOT EXISTS transport_paid_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS keeper_paid_out        BOOLEAN NOT NULL DEFAULT false;
