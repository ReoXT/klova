-- Permanent withdrawal PIN, decoupled from magic-link sessions.
--
-- The existing step-up reauth (hasFreshAuth/isAmrFresh) proves a RECENT
-- login and gates configuration changes (bank account, and now the PIN
-- itself). This PIN protects the RECURRING action — actually spending —
-- and deliberately does NOT depend on session freshness: it's set once and
-- stays valid across every future login until the keeper explicitly changes
-- it (which itself requires reauth).
--
-- pgcrypto is already installed (schema `extensions`) — used for bcrypt
-- hashing (crypt/gen_salt) so a leaked table is not a leaked PIN.
CREATE TABLE IF NOT EXISTS keeper_withdrawal_pins (
  cleaner_id      UUID PRIMARY KEY REFERENCES cleaners(id) ON DELETE CASCADE,
  pin_hash        TEXT NOT NULL,
  failed_attempts INT  NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE keeper_withdrawal_pins ENABLE ROW LEVEL SECURITY;
-- No policies — service role only, matching every other table
-- (see 20260617000003_rls.sql).

-- ─── keeper_set_withdrawal_pin ─────────────────────────────────────────────
-- Sets or changes the keeper's PIN. Callers MUST require a fresh
-- re-authentication (hasFreshAuth) before calling this — this function has
-- no way to enforce that itself, since it has no notion of session recency.
-- Always resets failed_attempts/locked_until: this is the ONLY place a lock
-- is ever cleared, and only atomically alongside a new PIN. There is no
-- standalone "unlock" — clearing a lock without setting a new PIN would
-- leave the account "unlocked" but still protected by a PIN the keeper may
-- have forgotten, defeating the point of resetting.
CREATE OR REPLACE FUNCTION keeper_set_withdrawal_pin(
  p_cleaner_id UUID,
  p_new_pin    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_phone TEXT;
  v_last4 TEXT;
BEGIN
  IF p_new_pin IS NULL OR p_new_pin !~ '^\d{4}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_format');
  END IF;

  -- Reject trivially guessable PINs: repeated digits, common sequences,
  -- and keypad patterns — the first things tried against a stolen phone.
  IF p_new_pin = ANY (ARRAY[
    '0000','1111','2222','3333','4444','5555','6666','7777','8888','9999',
    '1234','2345','3456','4567','5678','6789','9876','8765','7654','6543','5432','4321',
    '1212','2121','1010','0101','2580','0852'
  ]) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'weak_pin');
  END IF;

  SELECT phone INTO v_phone FROM cleaners WHERE id = p_cleaner_id;
  v_last4 := right(regexp_replace(COALESCE(v_phone, ''), '\D', '', 'g'), 4);
  IF v_last4 <> '' AND v_last4 = p_new_pin THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'weak_pin');
  END IF;

  INSERT INTO keeper_withdrawal_pins (cleaner_id, pin_hash, failed_attempts, locked_until, updated_at)
  VALUES (p_cleaner_id, extensions.crypt(p_new_pin, extensions.gen_salt('bf')), 0, NULL, now())
  ON CONFLICT (cleaner_id) DO UPDATE
    SET pin_hash = EXCLUDED.pin_hash,
        failed_attempts = 0,
        locked_until = NULL,
        updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ─── keeper_verify_withdrawal_pin ──────────────────────────────────────────
-- Verifies a submitted PIN for withdrawal. No advisory lock: unlike
-- keeper_request_withdrawal (which reads across multiple tables before a
-- conditional insert), this is a single-row, single-statement update —
-- ordinary Postgres row-level MVCC locking already serializes concurrent
-- attempts against one row.
--
-- Lockout: 5 wrong attempts locks for 15 minutes. The counter is NOT reset
-- merely because the lock window elapsed — only a correct PIN or an explicit
-- reset (keeper_set_withdrawal_pin) clears it. This means once locked, a
-- keeper gets one further attempt per subsequent window until they succeed
-- or reset, rather than a fresh batch of 5 guesses every 15 minutes.
CREATE OR REPLACE FUNCTION keeper_verify_withdrawal_pin(
  p_cleaner_id     UUID,
  p_submitted_pin  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_result RECORD;
BEGIN
  IF p_submitted_pin IS NULL OR p_submitted_pin !~ '^\d{4}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_format');
  END IF;

  -- Single atomic statement. The "already locked" check happens INSIDE the
  -- same UPDATE (via k.locked_until, which — per standard SQL UPDATE
  -- semantics — refers to this row's pre-update value at the moment THIS
  -- statement acquires the row lock), not via a preceding separate SELECT.
  -- That distinction matters: under concurrent calls, Postgres serializes
  -- UPDATEs to the same row one at a time. Each serialized call sees
  -- whatever the previous call already committed, so once one call's
  -- UPDATE sets locked_until, every subsequent call in the same burst
  -- correctly becomes a no-op instead of continuing to increment past 5.
  -- (An earlier version of this function checked lock state via a separate
  -- SELECT before the UPDATE — that always races: many concurrent calls can
  -- all pass the "not locked yet" check before any of them commits, and
  -- each would still increment unconditionally.)
  --
  -- "not_set" (no PIN configured) is detected via FOUND after the UPDATE
  -- rather than a separate existence check — if cleaner_id matches no row,
  -- the UPDATE (and its FROM subquery, same WHERE clause) affects zero rows.
  UPDATE keeper_withdrawal_pins k
  SET failed_attempts = CASE
                           WHEN k.locked_until IS NOT NULL AND k.locked_until > now() THEN k.failed_attempts
                           WHEN m.matched THEN 0
                           ELSE k.failed_attempts + 1
                         END,
      locked_until    = CASE
                           WHEN k.locked_until IS NOT NULL AND k.locked_until > now() THEN k.locked_until
                           WHEN m.matched THEN NULL
                           WHEN k.failed_attempts + 1 >= 5 THEN now() + interval '15 minutes'
                           ELSE k.locked_until
                         END,
      updated_at = now()
  FROM (
    SELECT extensions.crypt(p_submitted_pin, kp.pin_hash) = kp.pin_hash AS matched
    FROM keeper_withdrawal_pins kp
    WHERE kp.cleaner_id = p_cleaner_id
  ) m
  WHERE k.cleaner_id = p_cleaner_id
  RETURNING m.matched, k.failed_attempts, k.locked_until INTO v_result;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_set');
  END IF;

  -- Lock takes priority over a correct match: if the account is (or just
  -- became, via this same statement's 5th-attempt transition) locked, a
  -- correct PIN must still be rejected as locked, not accepted. m.matched
  -- reflects only the crypto comparison, independent of lock state, so it
  -- cannot be checked first here even though the UPDATE itself already
  -- correctly left failed_attempts/locked_until untouched while locked.
  IF v_result.locked_until IS NOT NULL AND v_result.locked_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', v_result.locked_until, 'attempts_remaining', 0);
  ELSIF v_result.matched THEN
    RETURN jsonb_build_object('ok', true);
  ELSE
    RETURN jsonb_build_object('ok', false, 'reason', 'incorrect', 'attempts_remaining', GREATEST(0, 5 - v_result.failed_attempts));
  END IF;
END;
$$;
