-- Replace the single-column UNIQUE on booking_id with a composite
-- (booking_id, cleaner_id) so that a 2-keeper booking can have one
-- cleaner_earnings row per assigned keeper.
--
-- Old model: one row per booking → lead cleaner was credited the full ~78%
-- New model: one row per (booking, cleaner) → each keeper gets an equal share
--
-- Existing rows are not affected: they all have distinct booking_id values
-- so they already satisfy the new composite unique constraint.

ALTER TABLE cleaner_earnings
  DROP CONSTRAINT IF EXISTS cleaner_earnings_booking_id_key;

ALTER TABLE cleaner_earnings
  ADD CONSTRAINT cleaner_earnings_booking_cleaner_unique
  UNIQUE (booking_id, cleaner_id);
