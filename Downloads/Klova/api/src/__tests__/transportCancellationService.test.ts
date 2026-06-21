import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('../config', () => ({
  config: { transportPaymentDeadlineHours: 24 },
}));

vi.mock('../services/notificationService', () => ({
  notifyKeeperJobCancelled: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/refundService', () => ({
  issueRefund: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/transportInvoiceService', () => ({
  issueTransportRefund: vi.fn().mockResolvedValue(undefined),
}));

import { supabase } from '../lib/supabase';
import { notifyKeeperJobCancelled } from '../services/notificationService';
import { issueRefund } from '../services/refundService';
import { issueTransportRefund } from '../services/transportInvoiceService';
import {
  cancelTransportOverdue,
  cancelConfirmedBooking,
  getAwaitingTransportBookings,
  TransportCancellationError,
} from '../services/transportCancellationService';

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

function awaitingBooking(overrides: object = {}) {
  return {
    id: 'booking-cancel-001',
    status: 'confirmed',
    transport_status: 'awaiting_payment',
    cleaner_id: 'cleaner-abc',
    booking_date: '2099-12-31', // far future — not past
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── cancelTransportOverdue — guards ─────────────────────────────────────────

describe('cancelTransportOverdue — booking not found', () => {
  it('throws 404', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({ data: null, error: { message: 'not found' } }) as any,
    );
    await expect(cancelTransportOverdue('missing')).rejects.toMatchObject({ status: 404 });
  });
});

describe('cancelTransportOverdue — already cancelled', () => {
  it('throws 409 idempotently', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({ data: awaitingBooking({ status: 'cancelled' }), error: null }) as any,
    );
    await expect(cancelTransportOverdue('b1')).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('already cancelled'),
    });
    expect(vi.mocked(notifyKeeperJobCancelled)).not.toHaveBeenCalled();
  });
});

describe('cancelTransportOverdue — wrong booking status', () => {
  it('throws 409 for a booking that is matched (not yet confirmed)', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({ data: awaitingBooking({ status: 'matched' }), error: null }) as any,
    );
    await expect(cancelTransportOverdue('b2')).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('"matched"'),
    });
  });
});

describe('cancelTransportOverdue — transport already settled', () => {
  it('throws 409 when transport_status is paid', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({
        data: awaitingBooking({ transport_status: 'paid' }),
        error: null,
      }) as any,
    );
    await expect(cancelTransportOverdue('b3')).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('"paid"'),
    });
  });

  it('throws 409 when transport_status is waived', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({
        data: awaitingBooking({ transport_status: 'waived' }),
        error: null,
      }) as any,
    );
    await expect(cancelTransportOverdue('b4')).rejects.toMatchObject({ status: 409 });
  });
});

// ─── cancelTransportOverdue — happy path ──────────────────────────────────────

describe('cancelTransportOverdue — happy path', () => {
  it('cancels the booking, frees the Keeper slot, and notifies the Keeper', async () => {
    const BOOKING_ID = 'b-cancel-happy';
    const cancelledRow = {
      id: BOOKING_ID,
      status: 'cancelled',
      transport_status: 'awaiting_payment',
      cancellation_reason: 'transport_payment_overdue',
    };

    vi.mocked(supabase.from)
      // call 1: fetch booking
      .mockReturnValueOnce(chain({ data: awaitingBooking({ id: BOOKING_ID }), error: null }) as any)
      // call 2: update bookings → cancel
      .mockReturnValueOnce(chain({ data: cancelledRow, error: null }) as any)
      // call 3: update cleaner_availability → free slot
      .mockReturnValueOnce(chain({ data: null, error: null }) as any);

    const result = await cancelTransportOverdue(BOOKING_ID);

    expect(result.status).toBe('cancelled');
    expect(result.cancellation_reason).toBe('transport_payment_overdue');

    // Keeper must be notified exactly once
    expect(vi.mocked(notifyKeeperJobCancelled)).toHaveBeenCalledOnce();
    expect(vi.mocked(notifyKeeperJobCancelled)).toHaveBeenCalledWith(BOOKING_ID);

    // Verify cleaner_availability was touched (third from() call happened)
    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(3);
  });
});

describe('cancelTransportOverdue — no cleaner_id (edge case)', () => {
  it('still cancels the booking but skips the availability update', async () => {
    const BOOKING_ID = 'b-no-cleaner';
    const cancelledRow = {
      id: BOOKING_ID,
      status: 'cancelled',
      transport_status: 'awaiting_payment',
      cancellation_reason: 'transport_payment_overdue',
    };

    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        chain({ data: awaitingBooking({ id: BOOKING_ID, cleaner_id: null }), error: null }) as any,
      )
      .mockReturnValueOnce(chain({ data: cancelledRow, error: null }) as any);

    const result = await cancelTransportOverdue(BOOKING_ID);

    expect(result.status).toBe('cancelled');
    // Only 2 DB calls (fetch + cancel); availability skip because no cleaner
    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(notifyKeeperJobCancelled)).toHaveBeenCalledOnce();
  });
});

describe('cancelTransportOverdue — availability update fails silently', () => {
  it('still returns success and notifies the Keeper even if DB availability update fails', async () => {
    const BOOKING_ID = 'b-avail-err';
    const cancelledRow = {
      id: BOOKING_ID,
      status: 'cancelled',
      transport_status: 'awaiting_payment',
      cancellation_reason: 'transport_payment_overdue',
    };

    vi.mocked(supabase.from)
      .mockReturnValueOnce(chain({ data: awaitingBooking({ id: BOOKING_ID }), error: null }) as any)
      .mockReturnValueOnce(chain({ data: cancelledRow, error: null }) as any)
      // Simulate availability update error — should be non-fatal
      .mockReturnValueOnce(chain({ data: null, error: { message: 'DB error' } }) as any);

    const result = await cancelTransportOverdue(BOOKING_ID);

    expect(result.status).toBe('cancelled');
    expect(vi.mocked(notifyKeeperJobCancelled)).toHaveBeenCalledOnce();
  });
});

// ─── getAwaitingTransportBookings ─────────────────────────────────────────────

describe('getAwaitingTransportBookings — empty result', () => {
  it('returns an empty array when no bookings are waiting', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({ data: [], error: null }) as any,
    );
    const result = await getAwaitingTransportBookings();
    expect(result).toEqual([]);
  });
});

describe('getAwaitingTransportBookings — overdue detection', () => {
  it('flags a booking as soft_overdue when transport_awaiting_since is >24h ago', async () => {
    const longAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25h ago

    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({
        data: [
          {
            id: 'b-overdue',
            booking_date: '2099-12-31',
            time_slot: 'morning',
            address: '10 Test St',
            transport_fare: 2000,
            transport_awaiting_since: longAgo,
            customers: { first_name: 'Ada', last_name: 'Obi', email: null, phone: '08011111111' },
            cleaners: { first_name: 'Tunde', last_name: 'Ola', phone: '08022222222' },
          },
        ],
        error: null,
      }) as any,
    );

    const [booking] = await getAwaitingTransportBookings();
    expect(booking!.is_soft_overdue).toBe(true);
    expect(booking!.is_booking_date_passed).toBe(false);
    expect(booking!.is_overdue).toBe(true);
    expect(booking!.hours_waiting).toBeGreaterThan(24);
  });

  it('flags a booking as booking_date_passed when the booking date is in the past', async () => {
    const recentStart = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago

    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({
        data: [
          {
            id: 'b-past-date',
            booking_date: '2000-01-01', // definitely past
            time_slot: null,
            address: '5 Old Rd',
            transport_fare: 1500,
            transport_awaiting_since: recentStart,
            customers: { first_name: 'Bisi', last_name: 'Ade', email: 'b@b.com', phone: '08033333333' },
            cleaners: { first_name: 'Emeka', last_name: 'Nwa', phone: '08044444444' },
          },
        ],
        error: null,
      }) as any,
    );

    const [booking] = await getAwaitingTransportBookings();
    expect(booking!.is_booking_date_passed).toBe(true);
    expect(booking!.is_overdue).toBe(true);
  });

  it('does not flag a fresh booking as overdue', async () => {
    const fresh = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30min ago

    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({
        data: [
          {
            id: 'b-fresh',
            booking_date: '2099-12-31',
            time_slot: 'afternoon',
            address: '2 New Ave',
            transport_fare: 3000,
            transport_awaiting_since: fresh,
            customers: { first_name: 'Chi', last_name: 'Eze', email: null, phone: '08055555555' },
            cleaners: { first_name: 'Kola', last_name: 'Ayo', phone: '08066666666' },
          },
        ],
        error: null,
      }) as any,
    );

    const [booking] = await getAwaitingTransportBookings();
    expect(booking!.is_soft_overdue).toBe(false);
    expect(booking!.is_booking_date_passed).toBe(false);
    expect(booking!.is_overdue).toBe(false);
    expect(booking!.hours_waiting).toBeLessThan(1);
  });

  it('treats null transport_awaiting_since as maximally overdue', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({
        data: [
          {
            id: 'b-null-since',
            booking_date: '2099-12-31',
            time_slot: null,
            address: '1 Missing St',
            transport_fare: 1000,
            transport_awaiting_since: null,
            customers: { first_name: 'Ife', last_name: 'Ola', email: null, phone: '08077777777' },
            cleaners: { first_name: 'Dayo', last_name: 'Bam', phone: '08088888888' },
          },
        ],
        error: null,
      }) as any,
    );

    const [booking] = await getAwaitingTransportBookings();
    expect(booking!.is_soft_overdue).toBe(true);
    expect(booking!.is_overdue).toBe(true);
  });
});

// ─── cancelConfirmedBooking ───────────────────────────────────────────────────

function confirmedBooking(overrides: object = {}) {
  return {
    id: 'b-cancel-confirmed-001',
    status: 'confirmed',
    cleaner_id: 'cleaner-xyz',
    booking_date: '2099-12-31',
    paystack_reference: 'txn_clean_pay_001',
    dispatched_at: null,
    transport_status: 'paid',
    transport_fare: 2000,
    transport_payment_ref: 'PRQ_001',
    transport_transaction_ref: 'txn_transport_001',
    ...overrides,
  };
}

describe('cancelConfirmedBooking — guards', () => {
  it('throws 404 when booking does not exist', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({ data: null, error: { message: 'not found' } }) as any,
    );
    await expect(cancelConfirmedBooking('missing')).rejects.toMatchObject({ status: 404 });
  });

  it('throws 409 when booking is already cancelled', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({ data: confirmedBooking({ status: 'cancelled' }), error: null }) as any,
    );
    await expect(cancelConfirmedBooking('b1')).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('already cancelled'),
    });
    expect(vi.mocked(issueRefund)).not.toHaveBeenCalled();
  });

  it('throws 409 when booking is not confirmed (e.g. matched)', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({ data: confirmedBooking({ status: 'matched' }), error: null }) as any,
    );
    await expect(cancelConfirmedBooking('b2')).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('"matched"'),
    });
  });

  it('throws 409 when booking has already been dispatched', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({ data: confirmedBooking({ dispatched_at: '2026-06-21T08:00:00Z' }), error: null }) as any,
    );
    await expect(cancelConfirmedBooking('b3')).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('dispatched'),
    });
    expect(vi.mocked(issueRefund)).not.toHaveBeenCalled();
  });
});

describe('cancelConfirmedBooking — transport paid with transaction ref', () => {
  it('cancels, refunds clean, refunds transport, frees slot, notifies keeper', async () => {
    const BOOKING_ID = 'b-full-refund';
    const cancelledRow = { id: BOOKING_ID, status: 'cancelled', cancellation_reason: 'admin_cancelled' };

    vi.mocked(supabase.from)
      .mockReturnValueOnce(chain({ data: confirmedBooking({ id: BOOKING_ID }), error: null }) as any)
      .mockReturnValueOnce(chain({ data: cancelledRow, error: null }) as any)   // cancel update
      .mockReturnValueOnce(chain({ data: null, error: null }) as any);           // availability free

    const result = await cancelConfirmedBooking(BOOKING_ID);

    expect(result.status).toBe('cancelled');
    expect(result.clean_refund).toBe('issued');
    expect(result.transport_refund).toBe('issued');

    expect(vi.mocked(issueRefund)).toHaveBeenCalledOnce();
    expect(vi.mocked(issueRefund)).toHaveBeenCalledWith(BOOKING_ID, 'txn_clean_pay_001');

    expect(vi.mocked(issueTransportRefund)).toHaveBeenCalledOnce();
    expect(vi.mocked(issueTransportRefund)).toHaveBeenCalledWith(BOOKING_ID, 'txn_transport_001');

    expect(vi.mocked(notifyKeeperJobCancelled)).toHaveBeenCalledOnce();
    expect(vi.mocked(notifyKeeperJobCancelled)).toHaveBeenCalledWith(BOOKING_ID);
  });
});

describe('cancelConfirmedBooking — transport paid but no transaction ref', () => {
  it('cancels and refunds clean but returns skipped_no_tx_ref for transport', async () => {
    const BOOKING_ID = 'b-no-txref';
    const cancelledRow = { id: BOOKING_ID, status: 'cancelled', cancellation_reason: 'admin_cancelled' };

    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        chain({ data: confirmedBooking({ id: BOOKING_ID, transport_transaction_ref: null }), error: null }) as any,
      )
      .mockReturnValueOnce(chain({ data: cancelledRow, error: null }) as any)
      .mockReturnValueOnce(chain({ data: null, error: null }) as any);

    const result = await cancelConfirmedBooking(BOOKING_ID);

    expect(result.clean_refund).toBe('issued');
    expect(result.transport_refund).toBe('skipped_no_tx_ref');

    expect(vi.mocked(issueRefund)).toHaveBeenCalledOnce();
    // Transport refund must NOT be attempted — no tx ref available
    expect(vi.mocked(issueTransportRefund)).not.toHaveBeenCalled();
    expect(vi.mocked(notifyKeeperJobCancelled)).toHaveBeenCalledOnce();
  });
});

describe('cancelConfirmedBooking — transport not paid (awaiting_payment)', () => {
  it('cancels and refunds clean; transport_refund is skipped_not_paid', async () => {
    const BOOKING_ID = 'b-transport-unpaid';
    const cancelledRow = { id: BOOKING_ID, status: 'cancelled', cancellation_reason: 'admin_cancelled' };

    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        chain({
          data: confirmedBooking({
            id: BOOKING_ID,
            transport_status: 'awaiting_payment',
            transport_transaction_ref: null,
          }),
          error: null,
        }) as any,
      )
      .mockReturnValueOnce(chain({ data: cancelledRow, error: null }) as any)
      .mockReturnValueOnce(chain({ data: null, error: null }) as any);

    const result = await cancelConfirmedBooking(BOOKING_ID);

    expect(result.clean_refund).toBe('issued');
    expect(result.transport_refund).toBe('skipped_not_paid');
    expect(vi.mocked(issueTransportRefund)).not.toHaveBeenCalled();
  });
});

describe('cancelConfirmedBooking — clean refund fails', () => {
  it('still cancels and returns clean_refund: failed (does not rethrow)', async () => {
    const BOOKING_ID = 'b-clean-fail';
    const cancelledRow = { id: BOOKING_ID, status: 'cancelled', cancellation_reason: 'admin_cancelled' };

    vi.mocked(issueRefund).mockRejectedValueOnce(new Error('Paystack timeout'));

    vi.mocked(supabase.from)
      .mockReturnValueOnce(chain({ data: confirmedBooking({ id: BOOKING_ID }), error: null }) as any)
      .mockReturnValueOnce(chain({ data: cancelledRow, error: null }) as any)
      .mockReturnValueOnce(chain({ data: null, error: null }) as any);

    const result = await cancelConfirmedBooking(BOOKING_ID);

    expect(result.status).toBe('cancelled');
    expect(result.clean_refund).toBe('failed');
    // Transport was paid and tx ref exists — still attempted
    expect(result.transport_refund).toBe('issued');
    expect(vi.mocked(notifyKeeperJobCancelled)).toHaveBeenCalledOnce();
  });
});

describe('cancelConfirmedBooking — no paystack_reference on booking', () => {
  it('returns skipped_no_ref for clean and still processes transport', async () => {
    const BOOKING_ID = 'b-no-clean-ref';
    const cancelledRow = { id: BOOKING_ID, status: 'cancelled', cancellation_reason: 'admin_cancelled' };

    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        chain({ data: confirmedBooking({ id: BOOKING_ID, paystack_reference: null }), error: null }) as any,
      )
      .mockReturnValueOnce(chain({ data: cancelledRow, error: null }) as any)
      .mockReturnValueOnce(chain({ data: null, error: null }) as any);

    const result = await cancelConfirmedBooking(BOOKING_ID);

    expect(result.clean_refund).toBe('skipped_no_ref');
    expect(vi.mocked(issueRefund)).not.toHaveBeenCalled();
    expect(result.transport_refund).toBe('issued');
  });
});
