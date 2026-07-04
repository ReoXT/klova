-- Durable audit trail for keeper-initiated bank-account changes.
--
-- A bank-account change redirects where a keeper's withdrawals land, so it's
-- a sensitive, money-movement-adjacent action. Every self-service create/update
-- from the keeper portal writes one row here: who changed it (cleaner + the
-- Supabase auth user behind the session), what the destination became (last 4
-- digits only — never the full number here), the Paystack-resolved account
-- name at the time, and whether the account number actually changed.
--
-- Account numbers are stored in full only on cleaner_bank_accounts (the live
-- record); this audit table keeps last-4 to stay useful without duplicating
-- the sensitive value across tables.
CREATE TABLE IF NOT EXISTS cleaner_bank_account_audit (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id             UUID NOT NULL REFERENCES cleaners(id) ON DELETE CASCADE,
  auth_user_id           UUID,                          -- session user who made the change
  action                 TEXT NOT NULL CHECK (action IN ('created', 'updated')),
  old_account_last4      TEXT,                           -- null on first-time create
  new_account_last4      TEXT NOT NULL,
  new_bank_code          TEXT NOT NULL,
  new_bank_name          TEXT NOT NULL,
  resolved_account_name  TEXT NOT NULL,                  -- name Paystack returned at change time
  account_number_changed BOOLEAN NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_audit_cleaner
  ON cleaner_bank_account_audit (cleaner_id, created_at DESC);

-- RLS: service role only, matching every other table in this project
-- (see supabase/migrations/20260617000003_rls.sql).
ALTER TABLE cleaner_bank_account_audit ENABLE ROW LEVEL SECURITY;
