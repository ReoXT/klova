-- Stamped when the admin fires the confirm-dispatch action.
-- NULL means not yet dispatched. The dispatch endpoint is gated on
-- transport_status IN ('paid', 'waived', 'not_required') — it will
-- refuse to set this value unless transport is settled.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;
