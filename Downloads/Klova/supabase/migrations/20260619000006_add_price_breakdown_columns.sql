-- Add price breakdown columns so revenue can show cleaning fees vs insurance separately.
-- base + addons = cleaning fee (cleaner earns 78% of this)
-- insurance = flat ₦1,300 per booking (100% retained by Klova, cleaner gets nothing)
-- base + addons + insurance = total_amount_kobo

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS base_amount_kobo      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS addons_amount_kobo     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS insurance_amount_kobo  INTEGER NOT NULL DEFAULT 0;

-- Backfill addons total per booking from booking_addons join
UPDATE bookings b
SET addons_amount_kobo = (
  SELECT COALESCE(SUM(a.amount_kobo), 0)
  FROM booking_addons ba
  JOIN addons a ON a.id = ba.addon_id
  WHERE ba.booking_id = b.id
);

-- Backfill insurance (inferred: total - base_price - addons; 0 if no insurance)
UPDATE bookings b
SET insurance_amount_kobo = GREATEST(0,
  b.total_amount_kobo - pr.amount_kobo - b.addons_amount_kobo
)
FROM pricing pr
WHERE pr.service_id = b.service_id AND pr.bedrooms = b.bedrooms;

-- Backfill base price (= total - addons - insurance)
UPDATE bookings
SET base_amount_kobo = total_amount_kobo - addons_amount_kobo - insurance_amount_kobo;
