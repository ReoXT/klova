import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('../services/notificationService', () => ({
  notifyCustomerDispatchConfirmed: vi.fn().mockResolvedValue(undefined),
  notifyKeeperDispatched: vi.fn().mockResolvedValue(undefined),
}));

import { supabase } from '../lib/supabase';
import {
  notifyCustomerDispatchConfirmed,
  notifyKeeperDispatched,
} from '../services/notificationService';
import { confirmDispatch, DispatchError } from '../services/dispatchService';

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

function confirmedBooking(transportStatus: string, extra: object = {}) {
  return {
    id: 'booking-001',
    status: 'confirmed',
    transport_status: transportStatus,
    transport_fare: transportStatus === 'awaiting_payment' ? 2500 : null,
    dispatched_at: null,
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Basic guards ─────────────────────────────────────────────────────────────

describe('confirmDispatch — booking not found', () => {
  it('throws 404', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({ data: null, error: { message: 'not found' } }) as any,
    );
    await expect(confirmDispatch('missing')).rejects.toMatchObject({ status: 404 });
  });
});

describe('confirmDispatch — booking not confirmed', () => {
  it('throws 409 when status is matched (clean payment not yet received)', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({
        data: { id: 'b1', status: 'matched', transport_status: 'paid', transport_fare: null, dispatched_at: null },
        error: null,
      }) as any,
    );
    await expect(confirmDispatch('b1')).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('"matched"'),
    });
  });
});

describe('confirmDispatch — already dispatched', () => {
  it('throws 409 when dispatched_at is already set', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({
        data: confirmedBooking('paid', { dispatched_at: '2026-06-20T10:00:00Z' }),
        error: null,
      }) as any,
    );
    await expect(confirmDispatch('b2')).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('already been dispatched'),
    });
  });
});

// ─── Transport gate — blocked ─────────────────────────────────────────────────

describe('confirmDispatch — transport gate blocks pending_quote', () => {
  it('throws 409 with a message to quote or waive first', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({ data: confirmedBooking('pending_quote'), error: null }) as any,
    );
    try {
      await confirmDispatch('b3');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DispatchError);
      expect((err as DispatchError).status).toBe(409);
      expect((err as DispatchError).message).toMatch(/not yet quoted/i);
    }
    // No notifications fired
    expect(vi.mocked(notifyCustomerDispatchConfirmed)).not.toHaveBeenCalled();
    expect(vi.mocked(notifyKeeperDispatched)).not.toHaveBeenCalled();
  });
});

describe('confirmDispatch — transport gate blocks awaiting_payment', () => {
  it('throws 409 with the fare amount in the message', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({ data: confirmedBooking('awaiting_payment'), error: null }) as any,
    );
    try {
      await confirmDispatch('b4');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DispatchError);
      expect((err as DispatchError).status).toBe(409);
      expect((err as DispatchError).message).toMatch(/not yet paid/i);
      expect((err as DispatchError).message).toMatch(/2,500/); // fare formatted in message
    }
    expect(vi.mocked(notifyCustomerDispatchConfirmed)).not.toHaveBeenCalled();
    expect(vi.mocked(notifyKeeperDispatched)).not.toHaveBeenCalled();
  });
});

// ─── Transport gate — allowed ─────────────────────────────────────────────────

const allowedStatuses = ['paid', 'waived', 'not_required'] as const;

for (const ts of allowedStatuses) {
  describe(`confirmDispatch — allowed when transport_status is '${ts}'`, () => {
    it('stamps dispatched_at and fires customer + keeper notifications', async () => {
      const BOOKING_ID = `b-${ts}`;
      vi.mocked(supabase.from)
        .mockReturnValueOnce(
          chain({ data: confirmedBooking(ts, { id: BOOKING_ID }), error: null }) as any,
        )
        .mockReturnValueOnce(
          chain({
            data: { id: BOOKING_ID, status: 'confirmed', transport_status: ts, dispatched_at: '2026-06-20T12:00:00Z' },
            error: null,
          }) as any,
        );

      const result = await confirmDispatch(BOOKING_ID);

      expect(result.dispatched_at).toBeTruthy();
      expect(vi.mocked(notifyCustomerDispatchConfirmed)).toHaveBeenCalledOnce();
      expect(vi.mocked(notifyCustomerDispatchConfirmed)).toHaveBeenCalledWith(BOOKING_ID);
      expect(vi.mocked(notifyKeeperDispatched)).toHaveBeenCalledOnce();
      expect(vi.mocked(notifyKeeperDispatched)).toHaveBeenCalledWith(BOOKING_ID);
    });
  });
}

// ─── Idempotency (duplicate call) ────────────────────────────────────────────

describe('confirmDispatch — duplicate call (already dispatched)', () => {
  it('returns 409 on the second call — notifications are NOT fired again', async () => {
    // Simulates state after the first successful dispatch
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({
        data: confirmedBooking('paid', { dispatched_at: '2026-06-20T12:00:00Z' }),
        error: null,
      }) as any,
    );

    await expect(confirmDispatch('b-dup')).rejects.toMatchObject({ status: 409 });
    expect(vi.mocked(notifyCustomerDispatchConfirmed)).not.toHaveBeenCalled();
    expect(vi.mocked(notifyKeeperDispatched)).not.toHaveBeenCalled();
  });
});
