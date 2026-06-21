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

vi.mock('../services/transportInvoiceService', () => ({
  handleTransportInvoicePaid: vi.fn().mockResolvedValue(undefined),
}));

import { supabase } from '../lib/supabase';
import { notifyAdminPaidBooking, notifyCleanerNewJob } from '../services/notificationService';
import { issueRefund } from '../services/refundService';
import { handleTransportInvoicePaid } from '../services/transportInvoiceService';
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

// ─── invoice.payment_successful — transport fare paid ─────────────────────────
//
// Paystack fires this event when a Payment Request is paid. The handler must:
//  - call handleTransportInvoicePaid with the request_code
//  - leave the clean-payment path (charge.success / matching / clean fields) untouched
//  - be idempotent on duplicate delivery

describe('postPaystackWebhook — invoice.payment_successful', () => {
  it('calls handleTransportInvoicePaid with the correct request_code and returns 200', async () => {
    const REQ_CODE = 'PRQ_transport_001';

    const res = mockRes();
    await postPaystackWebhook(
      signedReq({
        event: 'invoice.payment_successful',
        data: { request_code: REQ_CODE, paid: true, paid_at: new Date().toISOString(), amount: 250000 },
      }) as any,
      res,
    );

    expect(res.sendStatus).toHaveBeenCalledWith(200);
    expect(vi.mocked(handleTransportInvoicePaid)).toHaveBeenCalledOnce();
    // Second arg is null because this test payload has no transactions array
    expect(vi.mocked(handleTransportInvoicePaid)).toHaveBeenCalledWith(REQ_CODE, null);
  });

  it('passes the transaction reference when the payload includes a transactions array', async () => {
    const REQ_CODE = 'PRQ_transport_with_txref';
    const TX_REF = 'txn_settled_001';

    const res = mockRes();
    await postPaystackWebhook(
      signedReq({
        event: 'invoice.payment_successful',
        data: {
          request_code: REQ_CODE,
          paid: true,
          paid_at: new Date().toISOString(),
          amount: 200000,
          transactions: [{ reference: TX_REF }],
        },
      }) as any,
      res,
    );

    expect(res.sendStatus).toHaveBeenCalledWith(200);
    expect(vi.mocked(handleTransportInvoicePaid)).toHaveBeenCalledWith(REQ_CODE, TX_REF);
  });

  it('is idempotent — a duplicate delivery calls handleTransportInvoicePaid again and still returns 200', async () => {
    // handleTransportInvoicePaid's internal idempotency guard (transport_status === 'paid')
    // prevents double-processing; the webhook layer just passes through both times.
    const REQ_CODE = 'PRQ_transport_dup';

    const res1 = mockRes();
    const res2 = mockRes();

    await postPaystackWebhook(
      signedReq({ event: 'invoice.payment_successful', data: { request_code: REQ_CODE } }) as any,
      res1,
    );
    await postPaystackWebhook(
      signedReq({ event: 'invoice.payment_successful', data: { request_code: REQ_CODE } }) as any,
      res2,
    );

    expect(res1.sendStatus).toHaveBeenCalledWith(200);
    expect(res2.sendStatus).toHaveBeenCalledWith(200);
    expect(vi.mocked(handleTransportInvoicePaid)).toHaveBeenCalledTimes(2);
  });

  it('returns 200 and skips handleTransportInvoicePaid when request_code is absent', async () => {
    const res = mockRes();
    await postPaystackWebhook(
      signedReq({ event: 'invoice.payment_successful', data: {} }) as any,
      res,
    );

    expect(res.sendStatus).toHaveBeenCalledWith(200);
    expect(vi.mocked(handleTransportInvoicePaid)).not.toHaveBeenCalled();
  });

  it('rejects an invoice.payment_successful with a bad signature — does not call handleTransportInvoicePaid', async () => {
    const req = {
      body: Buffer.from('{"event":"invoice.payment_successful","data":{"request_code":"PRQ_hack"}}', 'utf8'),
      headers: { 'x-paystack-signature': 'deadbeefdeadbeef' },
    };
    const res = mockRes();
    await postPaystackWebhook(req as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(vi.mocked(handleTransportInvoicePaid)).not.toHaveBeenCalled();
  });
});

// ─── Path isolation — clean-payment and transport must never cross ─────────────
//
// A charge.success (clean payment) must NEVER call handleTransportInvoicePaid.
// An invoice.payment_successful (transport) must NEVER call notifyAdminPaidBooking,
// notifyCleanerNewJob, or issueRefund — and must never trigger any matching logic.

describe('postPaystackWebhook — path isolation', () => {
  it('charge.success does NOT call handleTransportInvoicePaid', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(chain({ data: [{ id: 'bid-iso-clean' }], error: null }) as any);

    const res = mockRes();
    await postPaystackWebhook(
      signedReq({ event: 'charge.success', data: { reference: 'txn_iso_clean' } }) as any,
      res,
    );

    expect(res.sendStatus).toHaveBeenCalledWith(200);
    expect(vi.mocked(handleTransportInvoicePaid)).not.toHaveBeenCalled();
    // Clean-payment notifications still fire
    expect(vi.mocked(notifyAdminPaidBooking)).toHaveBeenCalledOnce();
    expect(vi.mocked(notifyCleanerNewJob)).toHaveBeenCalledOnce();
  });

  it('invoice.payment_successful does NOT call notifyAdminPaidBooking, notifyCleanerNewJob, or issueRefund', async () => {
    const res = mockRes();
    await postPaystackWebhook(
      signedReq({
        event: 'invoice.payment_successful',
        data: { request_code: 'PRQ_iso_transport' },
      }) as any,
      res,
    );

    expect(res.sendStatus).toHaveBeenCalledWith(200);
    expect(vi.mocked(notifyAdminPaidBooking)).not.toHaveBeenCalled();
    expect(vi.mocked(notifyCleanerNewJob)).not.toHaveBeenCalled();
    expect(vi.mocked(issueRefund)).not.toHaveBeenCalled();
    // No direct DB access from the webhook layer — all DB work is inside the mocked service
    expect(vi.mocked(supabase.from)).not.toHaveBeenCalled();
  });
});
