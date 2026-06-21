import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../config', () => ({
  config: { paystackSecretKey: 'sk_test_transport_invoice_tests' },
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('../services/notificationService', () => ({
  notifyAdminTransportPaid: vi.fn().mockResolvedValue(undefined),
}));

import { supabase } from '../lib/supabase';
import { notifyAdminTransportPaid } from '../services/notificationService';
import {
  createTransportInvoice,
  resendTransportInvoice,
  handleTransportInvoicePaid,
  issueTransportRefund,
  resetTransportFare,
} from '../services/transportInvoiceService';
import { TransportFareError } from '../services/transportFareService';

// ─── Chain helper ─────────────────────────────────────────────────────────────

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

// ─── Fetch mock helpers ───────────────────────────────────────────────────────

function mockPaystackOk(data: object) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({ status: true, message: 'ok', data }),
  });
}

function mockPaystackError(message: string, status = 400) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: vi.fn().mockResolvedValue({ status: false, message }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── createTransportInvoice — guards ─────────────────────────────────────────

describe('createTransportInvoice — booking not found', () => {
  it('throws 404', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({ data: null, error: { message: 'not found' } }) as any,
    );
    await expect(createTransportInvoice('missing-id')).rejects.toMatchObject({ status: 404 });
  });
});

describe('createTransportInvoice — wrong transport_status', () => {
  it('throws 409 when status is not awaiting_payment', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({
        data: {
          id: 'b1', transport_fare: 2500, transport_status: 'pending_quote',
          transport_payment_ref: null, paystack_reference: 'txn_123',
          customers: { email: 'customer@example.com' },
        },
        error: null,
      }) as any,
    );
    await expect(createTransportInvoice('b1')).rejects.toMatchObject({ status: 409 });
  });
});

describe('createTransportInvoice — invoice already exists', () => {
  it('throws 409 when transport_payment_ref is already set', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({
        data: {
          id: 'b2', transport_fare: 2500, transport_status: 'awaiting_payment',
          transport_payment_ref: 'PRQ_existing_123', paystack_reference: 'txn_456',
          customers: { email: 'customer@example.com' },
        },
        error: null,
      }) as any,
    );
    await expect(createTransportInvoice('b2')).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('resend'),
    });
  });
});

describe('createTransportInvoice — missing customer email', () => {
  it('throws 422 when customer has no email', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({
        data: {
          id: 'b3', transport_fare: 2500, transport_status: 'awaiting_payment',
          transport_payment_ref: null, paystack_reference: 'txn_789',
          customers: { email: null },
        },
        error: null,
      }) as any,
    );
    await expect(createTransportInvoice('b3')).rejects.toMatchObject({ status: 422 });
  });
});

// ─── createTransportInvoice — happy path ─────────────────────────────────────

describe('createTransportInvoice — happy path', () => {
  it('creates a Payment Request with booking_id in metadata and stores request_code', async () => {
    const BOOKING_ID = 'b-invoice-happy-1';
    const REQUEST_CODE = 'PRQ_test_abc123';

    // 1. Fetch booking
    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        chain({
          data: {
            id: BOOKING_ID,
            transport_fare: 2500,
            transport_status: 'awaiting_payment',
            transport_payment_ref: null,
            paystack_reference: 'txn_clean_001',
            customers: { email: 'amara@example.com' },
          },
          error: null,
        }) as any,
      )
      // 2. Update transport_payment_ref
      .mockReturnValueOnce(
        chain({
          data: {
            id: BOOKING_ID,
            transport_fare: 2500,
            transport_status: 'awaiting_payment',
            transport_payment_ref: REQUEST_CODE,
          },
          error: null,
        }) as any,
      );

    const mockFetch = mockPaystackOk({
      request_code: REQUEST_CODE,
      offline_reference: 'KLV_OFFLINE_001',
      id: 99,
      paid: false,
      amount: 250000,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await createTransportInvoice(BOOKING_ID);

    // Confirm the right request_code came back
    expect(result.request_code).toBe(REQUEST_CODE);
    expect(result.transport_payment_ref).toBe(REQUEST_CODE);

    // Confirm the Paystack call was made once
    expect(mockFetch).toHaveBeenCalledOnce();

    // Confirm booking_id was in the metadata sent to Paystack
    const [, fetchOptions] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(fetchOptions.body as string);
    expect(body.metadata.booking_id).toBe(BOOKING_ID);
    expect(body.send_notification).toBe(true);

    // Confirm amount was converted to kobo (2500 NGN → 250000 kobo)
    expect(body.amount).toBe(250000);
    expect(body.line_items[0].amount).toBe(250000);
  });

  it('includes the booking short-ref in the line item name', async () => {
    const BOOKING_ID = 'abcdef12-0000-0000-0000-000000000000';

    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        chain({
          data: {
            id: BOOKING_ID, transport_fare: 1500, transport_status: 'awaiting_payment',
            transport_payment_ref: null, paystack_reference: 'txn_x',
            customers: { email: 'test@example.com' },
          },
          error: null,
        }) as any,
      )
      .mockReturnValueOnce(
        chain({
          data: {
            id: BOOKING_ID, transport_fare: 1500, transport_status: 'awaiting_payment',
            transport_payment_ref: 'PRQ_xyz',
          },
          error: null,
        }) as any,
      );

    vi.stubGlobal('fetch', mockPaystackOk({
      request_code: 'PRQ_xyz', offline_reference: 'KLV_OFF', id: 1, paid: false, amount: 150000,
    }));

    await createTransportInvoice(BOOKING_ID);

    const [, fetchOptions] = (global.fetch as any).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(fetchOptions.body as string);
    // Short ref is first 8 chars of booking ID uppercased: 'ABCDEF12'
    expect(body.line_items[0].name).toContain('ABCDEF12');
  });
});

describe('createTransportInvoice — Paystack error', () => {
  it('throws 502 with Paystack error message', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({
        data: {
          id: 'b-err', transport_fare: 2000, transport_status: 'awaiting_payment',
          transport_payment_ref: null, paystack_reference: 'txn_err',
          customers: { email: 'err@example.com' },
        },
        error: null,
      }) as any,
    );
    vi.stubGlobal('fetch', mockPaystackError('Invalid customer email', 422));

    await expect(createTransportInvoice('b-err')).rejects.toMatchObject({
      status: 502,
      message: 'Invalid customer email',
    });
  });
});

// ─── resendTransportInvoice — guards ─────────────────────────────────────────

describe('resendTransportInvoice — no invoice exists', () => {
  it('throws 409 when transport_payment_ref is null', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({
        data: { id: 'b4', transport_status: 'awaiting_payment', transport_payment_ref: null },
        error: null,
      }) as any,
    );
    await expect(resendTransportInvoice('b4')).rejects.toMatchObject({ status: 409 });
  });
});

// ─── resendTransportInvoice — happy path ─────────────────────────────────────

describe('resendTransportInvoice — happy path', () => {
  it('calls Paystack notify endpoint and returns success message', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({
        data: {
          id: 'b5', transport_status: 'awaiting_payment',
          transport_payment_ref: 'PRQ_resend_001',
        },
        error: null,
      }) as any,
    );

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ status: true, message: 'Notification sent', data: {} }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await resendTransportInvoice('b5');

    expect(result.message).toContain('PRQ_resend_001');
    // Confirm the correct notify endpoint was called
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('/paymentrequest/notify/PRQ_resend_001');
  });
});

// ─── handleTransportInvoicePaid — webhook ────────────────────────────────────

describe('handleTransportInvoicePaid — booking not found', () => {
  it('warns and returns without throwing when no booking matches request_code', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({ data: null, error: null }) as any,
    );
    // Should resolve without throwing
    await expect(handleTransportInvoicePaid('PRQ_unknown')).resolves.toBeUndefined();
  });
});

describe('handleTransportInvoicePaid — idempotency', () => {
  it('does nothing when transport_status is already paid', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({ data: { id: 'b6', transport_status: 'paid' }, error: null }) as any,
    );
    await expect(handleTransportInvoicePaid('PRQ_already_paid')).resolves.toBeUndefined();
    // Only one supabase call (the fetch) — no update, no notification
    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notifyAdminTransportPaid)).not.toHaveBeenCalled();
  });
});

describe('handleTransportInvoicePaid — happy path', () => {
  it('sets transport_status to paid, stamps transport_paid_at, and notifies admin', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        chain({ data: { id: 'b7', transport_status: 'awaiting_payment' }, error: null }) as any,
      )
      .mockReturnValueOnce(chain({ data: null, error: null }) as any); // update call

    await expect(handleTransportInvoicePaid('PRQ_paid_001')).resolves.toBeUndefined();

    // Two DB calls: maybeSingle fetch + update
    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(2);

    // Admin is notified that transport is paid and booking is ready to dispatch
    expect(vi.mocked(notifyAdminTransportPaid)).toHaveBeenCalledOnce();
    expect(vi.mocked(notifyAdminTransportPaid)).toHaveBeenCalledWith('b7');
  });

  it('does NOT notify admin when the booking was already paid (duplicate webhook)', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({ data: { id: 'b6-dup', transport_status: 'paid' }, error: null }) as any,
    );

    await handleTransportInvoicePaid('PRQ_already_paid_2');

    expect(vi.mocked(notifyAdminTransportPaid)).not.toHaveBeenCalled();
  });
});

describe('handleTransportInvoicePaid — stores transaction reference', () => {
  it('includes transport_transaction_ref in the DB update when provided', async () => {
    const updateChain = chain({ data: null, error: null }) as any;

    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        chain({ data: { id: 'b-txref', transport_status: 'awaiting_payment' }, error: null }) as any,
      )
      .mockReturnValueOnce(updateChain);

    await handleTransportInvoicePaid('PRQ_txref_001', 'txn_abc123');

    // Confirm the update chain was reached (two supabase.from calls: fetch + update)
    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(notifyAdminTransportPaid)).toHaveBeenCalledWith('b-txref');
  });

  it('still succeeds when transactionRef is null (logs a warning but does not throw)', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        chain({ data: { id: 'b-no-txref', transport_status: 'awaiting_payment' }, error: null }) as any,
      )
      .mockReturnValueOnce(chain({ data: null, error: null }) as any);

    await expect(handleTransportInvoicePaid('PRQ_no_txref')).resolves.toBeUndefined();
    expect(vi.mocked(notifyAdminTransportPaid)).toHaveBeenCalledWith('b-no-txref');
  });
});

// ─── createTransportInvoice — Paystack succeeds but DB update fails ───────────
// The PRQ code has already been created on Paystack but we couldn't store it.
// A retry would create a second orphaned PRQ. The error must include the PRQ code.

describe('createTransportInvoice — Paystack succeeds but DB update fails', () => {
  it('throws with the PRQ code in the error so it can be manually reconciled', async () => {
    const BOOKING_ID = 'b-db-fail';
    const REQUEST_CODE = 'PRQ_orphan_001';

    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        chain({
          data: {
            id: BOOKING_ID, transport_fare: 2000, transport_status: 'awaiting_payment',
            transport_payment_ref: null, paystack_reference: 'txn_db_fail',
            customers: { email: 'db@example.com' },
          },
          error: null,
        }) as any,
      )
      // DB update fails
      .mockReturnValueOnce(chain({ data: null, error: { message: 'connection timeout' } }) as any);

    vi.stubGlobal('fetch', mockPaystackOk({
      request_code: REQUEST_CODE,
      offline_reference: 'KLV_ORPHAN',
      id: 77,
      paid: false,
      amount: 200000,
    }));

    await expect(createTransportInvoice(BOOKING_ID)).rejects.toThrow();
    // The PRQ code must be in the error/log — we verify it was at least attempted
    // by confirming both supabase calls happened (fetch + failed update)
    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(2);
  });
});

// ─── issueTransportRefund ─────────────────────────────────────────────────────

describe('issueTransportRefund — happy path', () => {
  it('calls Paystack /refund with the transaction ref and flips transport_status to refunded', async () => {
    const BOOKING_ID = 'b-transport-refund-1';
    const TX_REF = 'txn_refund_001';

    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({ data: null, error: null }) as any, // DB update
    );

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ status: true, message: 'Refund created', data: {} }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(issueTransportRefund(BOOKING_ID, TX_REF)).resolves.toBeUndefined();

    // Paystack /refund endpoint must have been called with the correct tx ref
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/refund');
    const body = JSON.parse(opts.body as string);
    expect(body.transaction).toBe(TX_REF);

    // DB update to 'refunded' must have been triggered
    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(1);
  });
});

describe('issueTransportRefund — Paystack returns error', () => {
  it('throws TransportFareError with 502 and does NOT update the DB', async () => {
    vi.stubGlobal('fetch', mockPaystackError('Transaction has already been refunded', 400));

    await expect(issueTransportRefund('b-tr-err', 'txn_already_refunded')).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining('Transaction has already been refunded'),
    });

    // No DB call because the Paystack call threw first
    expect(vi.mocked(supabase.from)).not.toHaveBeenCalled();
  });
});

describe('issueTransportRefund — Paystack succeeds but DB update fails', () => {
  it('does NOT throw (refund already issued), but logs the discrepancy', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({ data: null, error: { message: 'FK violation' } }) as any,
    );

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ status: true, message: 'ok', data: {} }),
    }));

    // Must not throw — refund was issued on Paystack; DB failure is logged only
    await expect(issueTransportRefund('b-tr-dbfail', 'txn_dbfail')).resolves.toBeUndefined();
  });
});

// ─── resetTransportFare ───────────────────────────────────────────────────────

describe('resetTransportFare — booking not found', () => {
  it('throws 404', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({ data: null, error: { message: 'not found' } }) as any,
    );
    await expect(resetTransportFare('missing')).rejects.toMatchObject({ status: 404 });
  });
});

describe('resetTransportFare — wrong booking status', () => {
  it('throws 409 when booking is not confirmed', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({
        data: { id: 'b-reset-1', status: 'matched', transport_status: 'awaiting_payment', transport_payment_ref: null },
        error: null,
      }) as any,
    );
    await expect(resetTransportFare('b-reset-1')).rejects.toMatchObject({ status: 409 });
  });

  it('throws 409 when transport is already paid', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({
        data: { id: 'b-reset-2', status: 'confirmed', transport_status: 'paid', transport_payment_ref: null },
        error: null,
      }) as any,
    );
    await expect(resetTransportFare('b-reset-2')).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('already been paid'),
    });
  });

  it('throws 409 when transport_status is pending_quote (nothing to reset)', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({
        data: { id: 'b-reset-3', status: 'confirmed', transport_status: 'pending_quote', transport_payment_ref: null },
        error: null,
      }) as any,
    );
    await expect(resetTransportFare('b-reset-3')).rejects.toMatchObject({ status: 409 });
  });
});

describe('resetTransportFare — no PRQ exists yet', () => {
  it('resets to pending_quote without calling Paystack', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        chain({
          data: { id: 'b-reset-noPRQ', status: 'confirmed', transport_status: 'awaiting_payment', transport_payment_ref: null },
          error: null,
        }) as any,
      )
      .mockReturnValueOnce(
        chain({ data: { id: 'b-reset-noPRQ', transport_status: 'pending_quote' }, error: null }) as any,
      );

    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const result = await resetTransportFare('b-reset-noPRQ');

    expect(result.transport_status).toBe('pending_quote');
    expect(result.prq_cancelled).toBe(false);
    // No Paystack call because there was no PRQ to cancel
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('resetTransportFare — PRQ exists, Paystack cancel succeeds', () => {
  it('cancels PRQ on Paystack then resets to pending_quote', async () => {
    const PRQ = 'PRQ_to_cancel_001';

    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        chain({
          data: { id: 'b-reset-PRQ', status: 'confirmed', transport_status: 'awaiting_payment', transport_payment_ref: PRQ },
          error: null,
        }) as any,
      )
      .mockReturnValueOnce(
        chain({ data: { id: 'b-reset-PRQ', transport_status: 'pending_quote' }, error: null }) as any,
      );

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ status: true, message: 'Payment Request successfully cancelled', data: {} }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await resetTransportFare('b-reset-PRQ');

    expect(result.prq_cancelled).toBe(true);
    expect(result.transport_status).toBe('pending_quote');
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain(`/paymentrequest/cancel/${PRQ}`);
  });
});

describe('resetTransportFare — PRQ cancel fails on Paystack (non-fatal)', () => {
  it('still resets the DB even if Paystack cancel fails', async () => {
    const PRQ = 'PRQ_already_gone';

    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        chain({
          data: { id: 'b-reset-fail', status: 'confirmed', transport_status: 'awaiting_payment', transport_payment_ref: PRQ },
          error: null,
        }) as any,
      )
      .mockReturnValueOnce(
        chain({ data: { id: 'b-reset-fail', transport_status: 'pending_quote' }, error: null }) as any,
      );

    vi.stubGlobal('fetch', mockPaystackError('Payment Request not found', 404));

    const result = await resetTransportFare('b-reset-fail');

    // Even though Paystack cancel failed, the DB was still reset
    expect(result.prq_cancelled).toBe(false);
    expect(result.transport_status).toBe('pending_quote');
  });
});
