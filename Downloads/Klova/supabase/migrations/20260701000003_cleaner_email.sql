-- Add email to cleaners for the keeper portal login (Supabase Auth magic link).
-- Nullable: existing cleaner records predate keeper login and have no email yet.
-- Admin captures it when inviting a cleaner as a keeper.
--
-- Uniqueness is enforced case-insensitively via a partial index rather than a
-- plain UNIQUE constraint, since email comparison must be case-insensitive to
-- match how Supabase Auth normalizes email addresses.

ALTER TABLE cleaners
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cleaners_email_lower
  ON cleaners (lower(email))
  WHERE email IS NOT NULL;
