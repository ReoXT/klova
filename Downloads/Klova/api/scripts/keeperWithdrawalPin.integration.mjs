// Integration test for the withdrawal PIN RPCs
// (supabase/migrations/20260705000001_keeper_withdrawal_pin.sql). Runs
// against a real database — named without ".test" so vitest's offline suite
// ignores it, matching the existing keeperWithdrawal.integration.mjs.
//
// Run from the api/ dir: node --env-file=.env scripts/keeperWithdrawalPin.integration.mjs
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. --env-file=.env)");
  process.exit(2);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const results = [];
function ok(name, cond, detail) {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}${cond ? "" : `  (${JSON.stringify(detail)})`}`);
}

const ts = Date.now();
const cleanup = { cleanerIds: [] };

async function mkCleaner(phone) {
  const { data, error } = await admin.from("cleaners").insert({
    first_name: "PinTest", last_name: "V",
    phone: phone ?? `07${String(ts).slice(-8)}${Math.floor(Math.random() * 1000)}`.slice(0, 14),
    zone_id: (await admin.from("zones").select("id").limit(1).single()).data.id,
    status: "active",
  }).select("id").single();
  if (error) throw error;
  cleanup.cleanerIds.push(data.id);
  return data.id;
}

async function setPin(cleanerId, pin) {
  const { data, error } = await admin.rpc("keeper_set_withdrawal_pin", { p_cleaner_id: cleanerId, p_new_pin: pin });
  if (error) throw error;
  return data;
}
async function verifyPin(cleanerId, pin) {
  const { data, error } = await admin.rpc("keeper_verify_withdrawal_pin", { p_cleaner_id: cleanerId, p_submitted_pin: pin });
  if (error) throw error;
  return data;
}
async function rowFor(cleanerId) {
  return (await admin.from("keeper_withdrawal_pins").select("*").eq("cleaner_id", cleanerId).single()).data;
}

async function main() {
  // ── Weak PIN rejection ──────────────────────────────────────────────────
  {
    const k = await mkCleaner("08011112222");
    for (const weak of ["0000", "1234", "4321", "1212", "1010", "2580"]) {
      const r = await setPin(k, weak);
      ok(`weak PIN '${weak}' rejected`, r.ok === false && r.reason === "weak_pin", r);
    }
    // phone-derived: last 4 of 08011112222 is 2222 — already in the repeated-digit
    // blocklist, so use a phone whose last 4 digits aren't otherwise weak.
  }

  // ── Phone-derived PIN rejection (last 4 digits not in the generic blocklist) ──
  {
    const k = await mkCleaner("08033445566"); // last 4: 5566, not a generic weak pattern
    const r = await setPin(k, "5566");
    ok("PIN matching last 4 of own phone rejected", r.ok === false && r.reason === "weak_pin", r);
    const r2 = await setPin(k, "5567");
    ok("a PIN NOT matching phone/blocklist is accepted", r2.ok === true, r2);
  }

  // ── Invalid format ───────────────────────────────────────────────────────
  {
    const k = await mkCleaner();
    ok("3-digit PIN rejected", (await setPin(k, "123")).ok === false, null);
    ok("5-digit PIN rejected", (await setPin(k, "12345")).ok === false, null);
    ok("non-numeric PIN rejected", (await setPin(k, "abcd")).ok === false, null);
    ok("verify with bad format rejected without a row existing", (await verifyPin(k, "abcd")).reason === "invalid_format", null);
  }

  // ── Set + verify happy path, attempt reset on success ───────────────────
  {
    const k = await mkCleaner();
    ok("valid pin accepted", (await setPin(k, "7391")).ok === true, null);
    ok("verify not_set never returned once set", (await verifyPin(k, "0001")).reason !== "not_set", null);
    ok("wrong guess increments failed_attempts to 1", (await rowFor(k)).failed_attempts === 1, await rowFor(k));
    ok("correct guess succeeds", (await verifyPin(k, "7391")).ok === true, null);
    ok("correct guess resets failed_attempts to 0", (await rowFor(k)).failed_attempts === 0, await rowFor(k));
  }

  // ── not_set before any PIN configured ────────────────────────────────────
  {
    const k = await mkCleaner();
    const r = await verifyPin(k, "1357");
    ok("verify before any PIN set returns not_set", r.ok === false && r.reason === "not_set", r);
  }

  // ── Lockout at 5th wrong attempt, further attempts don't increment ─────
  {
    const k = await mkCleaner();
    await setPin(k, "6284");
    let lastResult;
    for (let i = 1; i <= 4; i++) {
      lastResult = await verifyPin(k, "0000");
      ok(`wrong attempt ${i}/4 returns incorrect with attempts_remaining=${5 - i}`, lastResult.reason === "incorrect" && lastResult.attempts_remaining === 5 - i, lastResult);
    }
    const fifth = await verifyPin(k, "0000");
    ok("5th wrong attempt triggers lock", fifth.ok === false && fifth.reason === "locked", fifth);
    ok("locked_until is in the future", new Date(fifth.locked_until).getTime() > Date.now(), fifth.locked_until);

    const rowAfterLock = await rowFor(k);
    ok("failed_attempts is exactly 5 after lockout", rowAfterLock.failed_attempts === 5, rowAfterLock);

    // Further attempts (even the CORRECT pin) are rejected while locked, and
    // must not further increment failed_attempts.
    const whileLocked = await verifyPin(k, "6284");
    ok("correct pin while locked is still rejected as locked", whileLocked.ok === false && whileLocked.reason === "locked", whileLocked);
    const rowStillLocked = await rowFor(k);
    ok("failed_attempts unchanged while locked (still 5)", rowStillLocked.failed_attempts === 5, rowStillLocked);

    // Resetting via set-new-pin is the ONLY way to clear the lock.
    const resetResult = await setPin(k, "9147");
    ok("setting a new pin while locked succeeds", resetResult.ok === true, resetResult);
    const rowAfterReset = await rowFor(k);
    ok("reset clears locked_until", rowAfterReset.locked_until === null, rowAfterReset);
    ok("reset clears failed_attempts to 0", rowAfterReset.failed_attempts === 0, rowAfterReset);
    ok("new pin verifies correctly after reset", (await verifyPin(k, "9147")).ok === true, null);
  }

  // ── Concurrency: many simultaneous wrong guesses never corrupt the counter ──
  {
    const k = await mkCleaner();
    await setPin(k, "3355");
    // 8 concurrent wrong guesses against a 5-attempt lockout threshold.
    const outcomes = await Promise.all(Array.from({ length: 8 }, () => verifyPin(k, "0000")));
    const lockedCount = outcomes.filter((o) => o.reason === "locked").length;
    const incorrectCount = outcomes.filter((o) => o.reason === "incorrect").length;
    ok("concurrency: every call returned a valid reason (incorrect or locked)", lockedCount + incorrectCount === 8, outcomes);
    const finalRow = await rowFor(k);
    // Each call recorded (via row-level MVCC serialization) is either a
    // pre-lock increment or a post-lock no-op — attempts must land exactly
    // at 5 (the point locking triggers) and never exceed it or go negative.
    ok("concurrency: failed_attempts settled at exactly 5 (never exceeded, never under)", finalRow.failed_attempts === 5, finalRow);
    ok("concurrency: lock is set", finalRow.locked_until !== null && new Date(finalRow.locked_until).getTime() > Date.now(), finalRow);
    ok("concurrency: at least one call observed the lock triggering", lockedCount >= 1, { lockedCount, incorrectCount });
  }

  // ── PIN persists across cleaner status changes ──────────────────────────
  {
    const k = await mkCleaner();
    await setPin(k, "4402");
    await admin.from("cleaners").update({ status: "suspended" }).eq("id", k);
    await admin.from("cleaners").update({ status: "active" }).eq("id", k);
    const r = await verifyPin(k, "4402");
    ok("PIN survives a suspend/reactivate cycle", r.ok === true, r);
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────
  await admin.from("keeper_withdrawal_pins").delete().in("cleaner_id", cleanup.cleanerIds);
  await admin.from("cleaners").delete().in("id", cleanup.cleanerIds);

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) { console.log("FAILURES:", failed.map((f) => f.name)); process.exit(1); }
}

main().catch(async (err) => {
  console.error("Test error:", err);
  try {
    await admin.from("keeper_withdrawal_pins").delete().in("cleaner_id", cleanup.cleanerIds);
    await admin.from("cleaners").delete().in("id", cleanup.cleanerIds);
  } catch {}
  process.exit(1);
});
