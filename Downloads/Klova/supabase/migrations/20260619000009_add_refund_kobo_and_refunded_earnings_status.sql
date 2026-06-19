-- Track the kobo amount that was refunded per booking (cumulative across partial refunds)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_kobo INTEGER NOT NULL DEFAULT 0;

-- Add 'refunded' as a valid cleaner_earnings status
DO $$
BEGIN
  ALTER TABLE cleaner_earnings DROP CONSTRAINT IF EXISTS cleaner_earnings_status_check;
  ALTER TABLE cleaner_earnings
    ADD CONSTRAINT cleaner_earnings_status_check
    CHECK (status IN ('unpaid', 'scheduled', 'paid', 'failed', 'refunded'));
END $$;
