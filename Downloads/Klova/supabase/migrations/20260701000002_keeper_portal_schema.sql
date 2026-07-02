-- Schema additions for the Keeper portal (login + on-demand wallet withdrawals).
-- No behavior changes — additive only. Existing rows are backfilled sensibly.

-- ── 1. Link cleaners to Supabase Auth ──────────────────────────────────────────
-- Nullable because existing cleaner records predate any keeper login system;
-- a keeper is linked the first time they complete onboarding/sign-up.
-- UNIQUE so one auth user can only ever map to one cleaner record.
-- ON DELETE SET NULL: deleting the auth user must not cascade-delete the
-- cleaner's booking/earnings history.
ALTER TABLE cleaners
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cleaners_auth_user_id ON cleaners (auth_user_id);

-- ── 2. Enforce one primary bank account per cleaner at the DB level ───────────
-- Previously only enforced in application code (see mark-paid / payout routes,
-- which do `.eq("is_primary", true).single()`). A second primary row would
-- silently break those `.single()` calls. This closes that gap.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cleaner_bank_accounts_one_primary
  ON cleaner_bank_accounts (cleaner_id)
  WHERE is_primary = true;

-- ── 3. Support keeper-initiated, arbitrary-amount withdrawals ─────────────────
-- requested_by distinguishes an admin-run batch payout from a keeper tapping
-- "withdraw" in the portal for a partial/arbitrary amount.
-- amount_kobo is nullable: admin batch payouts continue to derive their total
-- from total_kobo (sum of settled earnings); only keeper-initiated withdrawals
-- populate amount_kobo with the amount the keeper actually requested.
ALTER TABLE cleaner_payouts
  ADD COLUMN IF NOT EXISTS requested_by TEXT NOT NULL DEFAULT 'admin'
    CHECK (requested_by IN ('keeper', 'admin')),
  ADD COLUMN IF NOT EXISTS amount_kobo BIGINT;

-- Backfill: every payout row that predates this migration was admin-initiated
-- (the keeper withdrawal path did not exist yet). The column default already
-- covers new rows; this UPDATE is here for explicitness and to handle any
-- row where requested_by was somehow set NULL by a future rollback/replay.
UPDATE cleaner_payouts
SET    requested_by = 'admin'
WHERE  requested_by IS NULL;
