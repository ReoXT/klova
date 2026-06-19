-- Backfill: correct commission_kobo for bookings where insurance was included
-- but commission was calculated as 22% of the full total (wrong).
-- Correct formula: round(cleaning_fee × 0.22) + insurance_fee
-- Insurance fee is always 130,000 kobo (₦1,300 flat).
-- Cleaning fee = base price + add-ons (does NOT include insurance).

UPDATE bookings SET commission_kobo = 240000, updated_at = NOW()
WHERE id IN (
  '1ceb885a-5aa3-49fd-8d94-0dfc33c6ffea',
  'bd7e27b1-5127-47ba-a16c-e8956ec0fb01',
  'dfd5b572-57f0-44b6-afdc-6d5033cdca8a'
);

-- ₦8,500 cleaning (₦5,000 + ₦3,500 laundry) + ₦1,300 insurance
UPDATE bookings SET commission_kobo = 317000, updated_at = NOW()
WHERE id = '521b3e46-8093-454c-bbb3-4752270c7e51';

-- ₦9,600 cleaning (₦5,000 + ₦4,600 ironing) + ₦1,300 insurance
UPDATE bookings SET commission_kobo = 341200, updated_at = NOW()
WHERE id = '1dca1c09-0ab2-41de-b49d-bfc58ff0284e';
