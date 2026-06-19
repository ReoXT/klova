-- Cleaner bank accounts: added by admin when onboarding/editing a cleaner.
-- account_number is the 10-digit Nigerian NUBAN.
-- bank_code is the CBN/Paystack 3-digit code (e.g. "058" = GTBank).
-- paystack_recipient_code is set the first time a Paystack Transfer is initiated.
CREATE TABLE IF NOT EXISTS cleaner_bank_accounts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id              UUID NOT NULL REFERENCES cleaners(id) ON DELETE CASCADE,
  account_name            TEXT NOT NULL,
  account_number          CHAR(10) NOT NULL,
  bank_code               TEXT NOT NULL,
  bank_name               TEXT NOT NULL,
  paystack_recipient_code TEXT,
  is_primary              BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ DEFAULT now()
);

-- One unpaid earning per completed booking (78% of cleaning fee, never insurance).
CREATE TABLE IF NOT EXISTS cleaner_earnings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL UNIQUE REFERENCES bookings(id),
  cleaner_id  UUID NOT NULL REFERENCES cleaners(id),
  earning_kobo INTEGER NOT NULL,
  payout_id   UUID,
  status      TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (status IN ('unpaid', 'scheduled', 'paid', 'failed')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- One payout row per cleaner per batch (weekly admin-initiated run).
CREATE TABLE IF NOT EXISTS cleaner_payouts (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id                UUID NOT NULL REFERENCES cleaners(id),
  bank_account_id           UUID NOT NULL REFERENCES cleaner_bank_accounts(id),
  total_kobo                INTEGER NOT NULL,
  method                    TEXT NOT NULL DEFAULT 'paystack'
    CHECK (method IN ('paystack', 'manual')),
  paystack_transfer_reference TEXT UNIQUE,
  paystack_transfer_code    TEXT,
  status                    TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'success', 'failed', 'reversed')),
  failure_reason            TEXT,
  initiated_at              TIMESTAMPTZ,
  completed_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ DEFAULT now()
);

-- FK from earnings to payouts (deferred so table exists before referencing)
ALTER TABLE cleaner_earnings
  ADD CONSTRAINT fk_cleaner_earnings_payout
  FOREIGN KEY (payout_id) REFERENCES cleaner_payouts(id)
  DEFERRABLE INITIALLY DEFERRED;

-- RLS: same as other tables — service role bypasses, anon has zero access
ALTER TABLE cleaner_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaner_earnings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaner_payouts        ENABLE ROW LEVEL SECURITY;
