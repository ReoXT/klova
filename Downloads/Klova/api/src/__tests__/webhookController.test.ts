import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createHmac } from 'crypto';

// vi.mock factories are hoisted before all variable declarations,
// so the secret key must be a literal here — not a reference to SECRET below.
vi.mock('../config', () => ({
  config: { paystackSecretKey: 'sk_test_webhook_secret_for_tests' },
}));

// Used in signedReq() — must match the literal above exactly.
const SECRET = 'sk_test_webhook_secret_for_tests';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('../services/notificationService', () => ({
  notifyAdminPaidBooking: vi.fn().mockResolvedValue(undefined),
  notifyCleanerNewJob: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/payoutService', () => ({
  handleTransferWebhook: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/earningsService', () => ({
  adjustEarningForRefund: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/refundService', () => ({
  issueRefund: vi.fn().mockResolvedValue(undefined),
}));

import { supabase } from '../lib/supabase';
import { notifyAdminPaidBooking, notifyCleanerNewJob } from '../services/notificationService';
import { issueRefund } from '../services/refundService';
import { postPaystackWebhook } from '../controllers/webhookController';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

// Thenable Supabase chain — supports both direct-await (for UPDATE queries)
// and explicit terminal calls (.single / .maybeSingle for SELECT queries).
function chain(result: { data: unknown; error: unknown }) {
  const b: any = {};
  b.then = (resolve: (v: any) => any, reject?: (v: any) => any) =>
    Promise.resolve(result).then(resolve, reject);
  b.catch = (fn: (v: any) => any) => Promise.resolve(result).catch(fn);
  b.single = vi.fn().mockResolvedValue(result);
  b.maybeSingle = vi.fn().mockResolvedValue(result);
  for (const m of ['select', 'eq', 'update', 'not', 'in', 'gte', 'order']) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  return b;
}

// Builds a minimal Express-like request with a valid Paystack HMAC-SHA512 signature.
function signedReq(eventObj: object) {
  const body = JSON.stringify(eventObj);
  const rawBody = Buffer.from(body, 'utf8');
  const signature = createHmac('sha512', SECRET).update(rawBody).digest('hex');
  return {
    body: rawBody,
    headers: { 'x-paystack-signature': signature },
  };
}

// Minimal Express-like response recorder.
function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.sendStatus = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Signature verification ───────────────────────────────────────────────────

describe('postPaystackWebhook — signature verification', () => {
  it('returns 400 and touches nothing when the signature is wrong', async () => {
    const req = {
      body: Buffer.from('{"event":"charge.success","data":{"reference":"r1"}}', 'utf8'),
      headers: { 'x-paystack-signature': 'deadbeefdeadbeef' },
    };
    const res = mockRes();

    await postPaystackWebhook(req as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(vi.mocked(supabase.from)).not.toHaveBeenCalled();
  });

  it('accepts a request with a correct HMAC-SHA512 signature', async () => {
    // Valid signature on an unknown reference → warns internally, still returns 200
    vi.mocked(supabase.from)
      .mockReturnValueOnce(chain({ data: [], error: null }) as any)    // UPDATE: 0 rows
      .mockReturnValueOnce(chain({ data: null, error: null }) as any); // lookup: not found

    const res = mockRes();
    await postPaystackWebhook(
      signedReq({ event: 'charge.success', data: { reference: 'unknown-ref' } }) as any,
      res,
    );

    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });
});

// ─── charge.success — happy path ─────────────────────────────────────────────

describe('postPaystackWebhook — charge.success', () => {
  it('flips a matched booking to confirmed and sends admin + cleaner notifications', async () => {
    const BOOKING_ID = 'bid-happy-001';
    const REF = 'txn_confirmed';

    // The atomic UPDATE (matched → confirmed) returns the claimed row
    vi.mocked(supabase.from)
      .mockReturnValueOnce(chain({ data: [{ id: BOOKING_ID }], error: null }) as any);

    const res = mockRes();
    await postPaystackWebhook(
      signedReq({ event: 'charge.success', data: { reference: REF } }) as any,
      res,
    );

    expect(res.sendStatus).toHaveBeenCalledWith(200);
    expect(vi.mocked(notifyAdminPaidBooking)).toHaveBeenCalledOnce();
    expect(vi.mocked(notifyAdminPaidBooking)).toHaveBeenCalledWith(BOOKING_ID);
    expect(vi.mocked(notifyCleanerNewJob)).toHaveBeenCalledOnce();
    expect(vi.mocked(notifyCleanerNewJob)).toHaveBeenCalledWith(BOOKING_ID);
  });

  // ─── Idempotency ─────────────────────────────────────────────────────────────
  //
  // Paystack may retry webhook delivery. If the first delivery already confirmed
  // the booking, the second must NOT re-trigger notifications or error out.

  it('is idempotent when the same charge.success is delivered twice', async () => {
    const BOOKING_ID = 'bid-dup-001';
    const REF = 'txn_duplicate';

    // Second delivery: UPDATE returns 0 rows (status is already 'confirmed', not 'matched')
    vi.mocked(supabase.from)
      .mockReturnValueOnce(chain({ data: [], error: null }) as any)
      .mockReturnValueOnce(
        chain({ data: { id: BOOKING_ID, status: 'confirmed' }, error: null }) as any,
      );

    const res = mockRes();
    await postPaystackWebhook(
      signedReq({ event: 'charge.success', data: { reference: REF } }) as any,
      res,
    );

    expect(res.sendStatus).toHaveBeenCalledWith(200);
    expect(vi.mocked(notifyAdminPaidBooking)).not.toHaveBeenCalled();
    expect(vi.mocked(notifyCleanerNewJob)).not.toHaveBeenCalled();
    expect(vi.mocked(issueRefund)).not.toHaveBeenCalled();
  });

  // ─── Slot expiry race ─────────────────────────────────────────────────────────
  //
  // The 25-minute slot-expiry cron can cancel a booking while payment is in flight.
  // When a charge.success arrives for a cancelled booking, the customer must be
  // automatically refunded — they should never be charged for an unconfirmed booking.

  it('auto-refunds when payment arrives for a slot-expired (cancelled) booking', async () => {
    const BOOKING_ID = 'bid-expired-001';
    const REF = 'txn_slot_expired';

    // UPDATE: 0 rows (booking is cancelled, not matched)
    // Lookup: status is 'cancelled' (cron ran before payment landed)
    vi.mocked(supabase.from)
      .mockReturnValueOnce(chain({ data: [], error: null }) as any)
      .mockReturnValueOnce(
        chain({ data: { id: BOOKING_ID, status: 'cancelled' }, error: null }) as any,
      );

    const res = mockRes();
    await postPaystackWebhook(
      signedReq({ event: 'charge.success', data: { reference: REF } }) as any,
      res,
    );

    expect(res.sendStatus).toHaveBeenCalledWith(200);
    expect(vi.mocked(issueRefund)).toHaveBeenCalledOnce();
    expect(vi.mocked(issueRefund)).toHaveBeenCalledWith(BOOKING_ID, REF);
    expect(vi.mocked(notifyAdminPaidBooking)).not.toHaveBeenCalled();
    expect(vi.mocked(notifyCleanerNewJob)).not.toHaveBeenCalled();
  });

  it('returns 200 and warns when no booking matches the reference', async () => {
    const REF = 'txn_ghost';

    // UPDATE: 0 rows; lookup returns null (reference was never stored)
    vi.mocked(supabase.from)
      .mockReturnValueOnce(chain({ data: [], error: null }) as any)
      .mockReturnValueOnce(chain({ data: null, error: null }) as any);

    const res = mockRes();
    await postPaystackWebhook(
      signedReq({ event: 'charge.success', data: { reference: REF } }) as any,
      res,
    );

    expect(res.sendStatus).toHaveBeenCalledWith(200);
    expect(vi.mocked(issueRefund)).not.toHaveBeenCalled();
    expect(vi.mocked(notifyAdminPaidBooking)).not.toHaveBeenCalled();
  });
});

// ─── Other events ─────────────────────────────────────────────────────────────

describe('postPaystackWebhook — unhandled / other events', () => {
  it('acknowledges unknown event types with 200 without touching the DB', async () => {
    const res = mockRes();
    await postPaystackWebhook(
      signedReq({ event: 'invoice.payment_failed', data: {} }) as any,
      res,
    );

    expect(res.sendStatus).toHaveBeenCalledWith(200);
    expect(vi.mocked(supabase.from)).not.toHaveBeenCalled();
    expect(vi.mocked(notifyAdminPaidBooking)).not.toHaveBeenCalled();
  });

  it('ignores a charge.success with a missing reference field', async () => {
    const res = mockRes();
    await postPaystackWebhook(
      signedReq({ event: 'charge.success', data: {} }) as any, // no reference field
      res,
    );

    expect(res.sendStatus).toHaveBeenCalledWith(200);
    expect(vi.mocked(supabase.from)).not.toHaveBeenCalled();
  });
});
