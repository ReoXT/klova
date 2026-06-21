-- Capture the Paystack transaction reference when a transport invoice is paid.
-- Required to issue a transport refund if a confirmed booking is later cancelled.
-- The reference arrives in the invoice.payment_successful webhook's transactions array.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS transport_transaction_ref TEXT;

-- Add 'refunded' terminal state so cancelled+transport-paid bookings have a clean
-- audit trail distinct from 'waived' (admin absorbed cost) or 'not_required'.
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'bookings'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%transport_status%';
  IF con_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE bookings DROP CONSTRAINT ' || quote_ident(con_name);
  END IF;
END $$;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_transport_status_check
  CHECK (transport_status IN (
    'pending_quote',
    'awaiting_payment',
    'paid',
    'waived',
    'not_required',
    'refunded'
  ));
