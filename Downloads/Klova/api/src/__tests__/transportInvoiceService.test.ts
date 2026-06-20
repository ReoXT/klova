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
