-- transport_awaiting_since: stamped the moment transport_status transitions to
-- 'awaiting_payment'. Used to calculate how long a customer has been sitting on
-- an unpaid transport invoice. The deadline clock starts here.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS transport_awaiting_since TIMESTAMPTZ;

-- cancellation_reason: lightweight audit trail. Values used by this codebase:
--   'transport_payment_overdue' — cancelled by admin via /cancel-transport-overdue
--   Any future manual/admin cancellation reasons go here too.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
