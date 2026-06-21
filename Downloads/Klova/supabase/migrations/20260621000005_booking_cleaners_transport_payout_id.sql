-- Track which cleaner_payouts row includes each keeper's transport reimbursement.
--
-- Mirrors cleaner_earnings.payout_id so the state machine is consistent:
--
--   NULL + paid_out=false         → eligible for next payout run
--   non-NULL + paid_out=false     → in-flight (payout initiated, awaiting Paystack webhook)
--   NULL or non-NULL + paid_out=true → complete (transfer.success received)
--
-- On transfer.success: paid_out → true (already linked by transport_payout_id).
-- On transfer.failed/reversed: transport_payout_id → NULL (re-queues for next run).
--
-- No back-fill needed: existing rows have paid_out=false and transport_payout_id NULL,
-- so they are correctly treated as "not yet paid out."

ALTER TABLE booking_cleaners
  ADD COLUMN IF NOT EXISTS transport_payout_id UUID REFERENCES cleaner_payouts(id);
