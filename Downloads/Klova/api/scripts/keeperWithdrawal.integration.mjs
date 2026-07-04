// Integration test for the keeper_request_withdrawal RPC — the money-safety
// core of POST /keeper/withdraw (defined in
// supabase/migrations/20260704000003_keeper_withdrawal_fn.sql). Runs against a
// real database; the RPC's per-keeper advisory-lock atomicity can't be
// exercised with mocks, so this is intentionally not part of the offline
// vitest suite (its name has no ".test" so `vitest run` ignores it).
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Run from the api/ dir:
//   node --env-file=.env scripts/keeperWithdrawal.integration.mjs
//
// Covers the three required scenarios plus guards:
//   • a ₦500 withdrawal from a larger balance succeeds and reserves it
//   • an over-balance request is rejected with no row inserted
//   • many concurrent requests never overdraw (advisory-lock serialization)
//   • no bank account on file / non-positive amounts are rejected
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
const cleanup = { cleanerIds: [], customerIds: [], bookingIds: [], bankIds: [] };
let ZONE_ID, SERVICE_ID;

async function loadRefs() {
  const { data: zone } = await admin.from("zones").select("id").limit(1).single();
  const { data: svc } = await admin.from("services").select("id").limit(1).single();
  ZONE_ID = zone.id; SERVICE_ID = svc.id;
}

async function mkCleaner() {
  const { data, error } = await admin.from("cleaners").insert({
    first_name: "WdrawTest", last_name: "V",
    phone: `07${String(ts).slice(-8)}${Math.floor(Math.random() * 1000)}`.slice(0, 14),
    zone_id: ZONE_ID, status: "active",
  }).select("id").single();
  if (error) throw error;
  cleanup.cleanerIds.push(data.id);
  return data.id;
}

async function mkBank(cleanerId) {
  const { data, error } = await admin.from("cleaner_bank_accounts").insert({
    cleaner_id: cleanerId, account_name: "Test", account_number: "0000000000",
    bank_code: "058", bank_name: "GTBank", is_primary: true,
  }).select("id").single();
  if (error) throw error;
  cleanup.bankIds.push(data.id);
  return data.id;
}

async function mkCustomer() {
  const { data, error } = await admin.from("customers").insert({
    first_name: "C", last_name: "V", phone: `08${String(ts).slice(-8)}${Math.floor(Math.random() * 1000)}`.slice(0, 14),
  }).select("id").single();
  if (error) throw error;
  cleanup.customerIds.push(data.id);
  return data.id;
}

// Give the keeper `kobo` of owed (unpaid) earnings, so available == kobo.
async function seedAvailable(cleanerId, customerId, kobo) {
  const { data: b, error: bErr } = await admin.from("bookings").insert({
    customer_id: customerId, cleaner_id: cleanerId, zone_id: ZONE_ID, service_id: SERVICE_ID,
    bedrooms: "2", booking_date: "2026-06-01", address: "1 Test Rd",
    total_amount_kobo: 950000, commission_kobo: 209000,
    base_amount_kobo: 950000, addons_amount_kobo: 0, insurance_amount_kobo: 0,
    status: "completed", refund_kobo: 0,
  }).select("id").single();
  if (bErr) throw bErr;
  cleanup.bookingIds.push(b.id);
  const { error: eErr } = await admin.from("cleaner_earnings").insert({
    booking_id: b.id, cleaner_id: cleanerId, earning_kobo: kobo, status: "unpaid",
  });
  if (eErr) throw eErr;
}

async function withdraw(cleanerId, amountKobo) {
  const { data, error } = await admin.rpc("keeper_request_withdrawal", {
    p_cleaner_id: cleanerId, p_amount_kobo: amountKobo,
  });
  if (error) throw error;
  return data;
}

async function pendingRows(cleanerId) {
  const { data } = await admin.from("cleaner_payouts")
    .select("amount_kobo, status, requested_by").eq("cleaner_id", cleanerId);
  return data ?? [];
}

async function main() {
  await loadRefs();

  // ── ₦500 from a larger balance works ────────────────────────────────────
  {
    const k = await mkCleaner();
    await mkBank(k);
    await seedAvailable(k, await mkCustomer(), 100000); // ₦1,000 available
    const r = await withdraw(k, 50000);                 // withdraw ₦500
    ok("₦500 withdrawal from ₦1,000 succeeds", r.ok === true && !!r.payout_id, r);
    ok("₦500: reported available was 100000", r.available_kobo === 100000, r);
    const rows = await pendingRows(k);
    ok("₦500: one pending keeper payout of 50000 reserved", rows.length === 1 && rows[0].status === "pending" && rows[0].amount_kobo === 50000 && rows[0].requested_by === "keeper", rows);
    const r2 = await withdraw(k, 50001);                // remaining is exactly 50000
    ok("₦500: cannot then take more than the remaining 50000", r2.ok === false && r2.reason === "insufficient" && r2.available_kobo === 50000, r2);
    const r3 = await withdraw(k, 50000);                // exactly the remainder is allowed
    ok("₦500: can take exactly the remaining 50000", r3.ok === true, r3);
  }

  // ── Over-balance rejected, no row inserted ──────────────────────────────
  {
    const k = await mkCleaner();
    await mkBank(k);
    await seedAvailable(k, await mkCustomer(), 100000);
    const r = await withdraw(k, 100001);
    ok("over-balance rejected as insufficient", r.ok === false && r.reason === "insufficient", r);
    ok("over-balance reports available 100000", r.available_kobo === 100000, r);
    const rows = await pendingRows(k);
    ok("over-balance inserted NO payout row", rows.length === 0, rows);
  }

  // ── Concurrency: many simultaneous requests never overdraw ──────────────
  {
    const k = await mkCleaner();
    await mkBank(k);
    await seedAvailable(k, await mkCustomer(), 100000); // ₦1,000
    // 10 concurrent requests of 15000 each: at most floor(100000/15000)=6 fit.
    const calls = Array.from({ length: 10 }, () => withdraw(k, 15000));
    const outcomes = await Promise.all(calls);
    const okCount = outcomes.filter((o) => o.ok === true).length;
    const insuffCount = outcomes.filter((o) => o.ok === false && o.reason === "insufficient").length;
    ok("concurrency: exactly 6 of 10 succeeded", okCount === 6, { okCount, insuffCount });
    ok("concurrency: the other 4 were insufficient", insuffCount === 4, { okCount, insuffCount });
    const rows = await pendingRows(k);
    const reserved = rows.reduce((s, r) => s + r.amount_kobo, 0);
    ok("concurrency: total reserved never exceeds balance", reserved === 90000 && reserved <= 100000, { reserved, rows: rows.length });
  }

  // ── Two simultaneous requests that together overdraw ────────────────────
  {
    const k = await mkCleaner();
    await mkBank(k);
    await seedAvailable(k, await mkCustomer(), 100000);
    const [a, b] = await Promise.all([withdraw(k, 60000), withdraw(k, 60000)]);
    const okCount = [a, b].filter((o) => o.ok === true).length;
    ok("two concurrent 60k on 100k: exactly one succeeds", okCount === 1, { a, b });
    const reserved = (await pendingRows(k)).reduce((s, r) => s + r.amount_kobo, 0);
    ok("two concurrent: only 60000 reserved (no overdraw)", reserved === 60000, reserved);
  }

  // ── No bank account on file ─────────────────────────────────────────────
  {
    const k = await mkCleaner();
    await seedAvailable(k, await mkCustomer(), 100000); // has balance, no bank
    const r = await withdraw(k, 10000);
    ok("no bank account rejected with reason no_bank", r.ok === false && r.reason === "no_bank", r);
  }

  // ── Non-positive amounts ────────────────────────────────────────────────
  {
    const k = await mkCleaner();
    await mkBank(k);
    await seedAvailable(k, await mkCustomer(), 100000);
    const z = await withdraw(k, 0);
    const n = await withdraw(k, -100);
    ok("zero amount rejected as invalid_amount", z.ok === false && z.reason === "invalid_amount", z);
    ok("negative amount rejected as invalid_amount", n.ok === false && n.reason === "invalid_amount", n);
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────
  await admin.from("cleaner_payouts").delete().in("cleaner_id", cleanup.cleanerIds);
  await admin.from("cleaner_earnings").delete().in("booking_id", cleanup.bookingIds);
  await admin.from("bookings").delete().in("id", cleanup.bookingIds);
  await admin.from("cleaner_bank_accounts").delete().in("id", cleanup.bankIds);
  await admin.from("customers").delete().in("id", cleanup.customerIds);
  await admin.from("cleaners").delete().in("id", cleanup.cleanerIds);

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) { console.log("FAILURES:", failed.map((f) => f.name)); process.exit(1); }
}

main().catch(async (err) => {
  console.error("Test error:", err);
  try {
    await admin.from("cleaner_payouts").delete().in("cleaner_id", cleanup.cleanerIds);
    await admin.from("cleaner_earnings").delete().in("booking_id", cleanup.bookingIds);
    await admin.from("bookings").delete().in("id", cleanup.bookingIds);
    await admin.from("cleaner_bank_accounts").delete().in("id", cleanup.bankIds);
    await admin.from("customers").delete().in("id", cleanup.customerIds);
    await admin.from("cleaners").delete().in("id", cleanup.cleanerIds);
  } catch {}
  process.exit(1);
});
