-- Store the customer's preferred arrival time slot
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS time_slot TEXT;
