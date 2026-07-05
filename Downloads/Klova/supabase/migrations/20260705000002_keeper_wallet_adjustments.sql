-- Audited manual corrections to a keeper's wallet balance, made from the
-- admin payouts oversight screen. Keeper self-service withdrawal is the only
-- normal payout path now (see 20260704000003_keeper_withdrawal_fn.sql and the
-- removal of the old admin batch-payout screen), so this exists purely for
-- the rare correction: a booking mispriced, a keeper shorted or overpaid by
-- some earlier bug, etc.
--
-- Deliberately its own table rather than another cleaner_payouts row:
-- cleaner_payouts represents a real Paystack transfer attempt (has a
-- reference, a transfer_code, a status lifecycle); an adjustment is a paper
-- correction with no transfer behind it. Signed amount_kobo (positive =
-- credit, adds to available balance; negative = debit, removes from it), and
-- a non-empty note is mandatory, matching the requirement that every
-- correction be explained, not just logged as a number.
--
-- Both getWalletSummary and getWalletTransactions (web/app/api/keeper/_wallet.ts)
-- read this table directly, so a keeper's own wallet page and the admin
-- oversight page are computed from literally the same source and can never
-- drift apart.
CREATE TABLE IF NOT EXISTS cleaner_wallet_adjustments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id   UUID NOT NULL REFERENCES cleaners(id) ON DELETE CASCADE,
  amount_kobo  BIGINT NOT NULL CHECK (amount_kobo <> 0),
  note         TEXT NOT NULL CHECK (char_length(trim(note)) > 0),
  created_by   TEXT NOT NULL DEFAULT 'admin',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_adjustments_cleaner
  ON cleaner_wallet_adjustments (cleaner_id, created_at DESC);

-- RLS: service role only, matching every other table in this project
-- (see supabase/migrations/20260617000003_rls.sql).
ALTER TABLE cleaner_wallet_adjustments ENABLE ROW LEVEL SECURITY;
