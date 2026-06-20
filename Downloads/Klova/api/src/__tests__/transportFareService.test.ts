import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../config', () => ({
  config: { transportFareCeilingNgn: 5000 },
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from '../lib/supabase';
import {
  validateTransportFareInput,
  recordTransportFare,
  TransportFareError,
} from '../services/transportFareService';

// ─── Chain helper (mirrors webhookController.test.ts pattern) ────────────────

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

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── validateTransportFareInput ───────────────────────────────────────────────

describe('validateTransportFareInput — valid inputs', () => {
  it('accepts a positive amount and returns a quote action', () => {
    const result = validateTransportFareInput({ amount: 3000 });
    expect(result).toEqual({ action: 'quote', amount_ngn: 3000 });
  });

  it('accepts a decimal amount', () => {
    const result = validateTransportFareInput({ amount: 2500.5 });
    expect(result).toEqual({ action: 'quote', amount_ngn: 2500.5 });
  });

  it('accepts waive: true and returns a waive action', () => {
    const result = validateTransportFareInput({ waive: true });
    expect(result).toEqual({ action: 'waive' });
  });

  it('accepts amount at exactly the ceiling', () => {
    const result = validateTransportFareInput({ amount: 5000 });
    expect(result).toEqual({ action: 'quote', amount_ngn: 5000 });
  });
});

describe('validateTransportFareInput — invalid inputs', () => {
  it('rejects zero amount with 422', () => {
    expect(() => validateTransportFareInput({ amount: 0 })).toThrow(TransportFareError);
    try {
      validateTransportFareInput({ amount: 0 });
    } catch (err) {
      expect(err).toBeInstanceOf(TransportFareError);
      expect((err as TransportFareError).status).toBe(422);
      expect((err as TransportFareError).message).toMatch(/positive/i);
    }
  });

  it('rejects a negative amount with 422', () => {
    try {
      validateTransportFareInput({ amount: -500 });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TransportFareError);
      expect((err as TransportFareError).status).toBe(422);
    }
  });

  it('rejects an amount above the ceiling with 422', () => {
    try {
      validateTransportFareInput({ amount: 50000 }); // 10× the ₦5,000 ceiling
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TransportFareError);
      expect((err as TransportFareError).status).toBe(422);
      expect((err as TransportFareError).message).toMatch(/exceeds/i);
    }
  });

  it('rejects a non-numeric amount string with 422', () => {
    try {
      validateTransportFareInput({ amount: 'lots' });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TransportFareError);
      expect((err as TransportFareError).status).toBe(422);
    }
  });

  it('rejects when both amount and waive are provided with 400', () => {
    try {
      validateTransportFareInput({ amount: 2000, waive: true });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TransportFareError);
      expect((err as TransportFareError).status).toBe(400);
      expect((err as TransportFareError).message).toMatch(/only one/i);
    }
  });

  it('rejects when neither amount nor waive nor not_required is provided with 400', () => {
    try {
      validateTransportFareInput({});
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TransportFareError);
      expect((err as TransportFareError).status).toBe(400);
    }
  });

  it('rejects when not_required and amount are both provided with 400', () => {
    try {
      validateTransportFareInput({ not_required: true, amount: 500 });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TransportFareError);
      expect((err as TransportFareError).status).toBe(400);
      expect((err as TransportFareError).message).toMatch(/only one/i);
    }
  });
});

describe('validateTransportFareInput — not_required', () => {
  it('accepts not_required: true and returns a not_required action', () => {
    const result = validateTransportFareInput({ not_required: true });
    expect(result).toEqual({ action: 'not_required' });
  });
});

// ─── recordTransportFare — precondition guards ────────────────────────────────

describe('recordTransportFare — booking not found', () => {
  it('throws 404 when the booking does not exist', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({ data: null, error: { message: 'not found' } }) as any,
    );

    await expect(
      recordTransportFare('missing-id', { action: 'quote', amount_ngn: 2000 }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('recordTransportFare — booking not confirmed', () => {
  it('throws 409 when clean payment has not been confirmed yet', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({
        data: { id: 'b1', status: 'matched', cleaner_id: 'c1', transport_status: 'pending_quote' },
        error: null,
      }) as any,
    );

    await expect(
      recordTransportFare('b1', { action: 'quote', amount_ngn: 2000 }),
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('"matched"'),
    });
  });
});

describe('recordTransportFare — no assigned Keeper', () => {
  it('throws 409 when cleaner_id is null', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({
        data: { id: 'b2', status: 'confirmed', cleaner_id: null, transport_status: 'pending_quote' },
        error: null,
      }) as any,
    );

    await expect(
      recordTransportFare('b2', { action: 'quote', amount_ngn: 2000 }),
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('no assigned Keeper'),
    });
  });
});

describe('recordTransportFare — transport already recorded', () => {
  it('throws 409 when transport_status is not pending_quote', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      chain({
        data: {
          id: 'b3',
          status: 'confirmed',
          cleaner_id: 'c1',
          transport_status: 'awaiting_payment',
        },
        error: null,
      }) as any,
    );

    await expect(
      recordTransportFare('b3', { action: 'quote', amount_ngn: 2000 }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

// ─── recordTransportFare — happy paths ───────────────────────────────────────

describe('recordTransportFare — happy path quote', () => {
  it('stores the fare and sets transport_status to awaiting_payment', async () => {
    const BOOKING_ID = 'b-happy-1';
    const updatedRow = {
      id: BOOKING_ID,
      status: 'confirmed',
      cleaner_id: 'cleaner-abc',
      booking_date: '2026-06-25',
      address: '14 Admiralty Way',
      total_amount_kobo: 950000,
      commission_kobo: 209000,
      transport_fare: 2000,
      transport_status: 'awaiting_payment',
      transport_payment_ref: null,
      transport_paid_at: null,
    };

    // First call: fetch guard  /  Second call: update
    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        chain({
          data: { id: BOOKING_ID, status: 'confirmed', cleaner_id: 'cleaner-abc', transport_status: 'pending_quote' },
          error: null,
        }) as any,
      )
      .mockReturnValueOnce(chain({ data: updatedRow, error: null }) as any);

    const result = await recordTransportFare(BOOKING_ID, { action: 'quote', amount_ngn: 2000 });

    expect(result.transport_fare).toBe(2000);
    expect(result.transport_status).toBe('awaiting_payment');
  });
});

describe('recordTransportFare — happy path waive', () => {
  it('sets transport_fare to 0 and transport_status to waived', async () => {
    const BOOKING_ID = 'b-waive-1';
    const updatedRow = {
      id: BOOKING_ID,
      status: 'confirmed',
      cleaner_id: 'cleaner-xyz',
      booking_date: '2026-06-26',
      address: '5 Chevron Drive',
      total_amount_kobo: 500000,
      commission_kobo: 110000,
      transport_fare: 0,
      transport_status: 'waived',
      transport_payment_ref: null,
      transport_paid_at: null,
    };

    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        chain({
          data: { id: BOOKING_ID, status: 'confirmed', cleaner_id: 'cleaner-xyz', transport_status: 'pending_quote' },
          error: null,
        }) as any,
      )
      .mockReturnValueOnce(chain({ data: updatedRow, error: null }) as any);

    const result = await recordTransportFare(BOOKING_ID, { action: 'waive' });

    expect(result.transport_fare).toBe(0);
    expect(result.transport_status).toBe('waived');
  });
});

describe('recordTransportFare — happy path not_required', () => {
  it('sets transport_fare to null and transport_status to not_required', async () => {
    const BOOKING_ID = 'b-notreq-1';
    const updatedRow = {
      id: BOOKING_ID,
      status: 'confirmed',
      cleaner_id: 'cleaner-local',
      booking_date: '2026-06-27',
      address: '3 Eko Street',
      total_amount_kobo: 1400000,
      commission_kobo: 308000,
      transport_fare: null,
      transport_status: 'not_required',
      transport_payment_ref: null,
      transport_paid_at: null,
    };

    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        chain({
          data: { id: BOOKING_ID, status: 'confirmed', cleaner_id: 'cleaner-local', transport_status: 'pending_quote' },
          error: null,
        }) as any,
      )
      .mockReturnValueOnce(chain({ data: updatedRow, error: null }) as any);

    const result = await recordTransportFare(BOOKING_ID, { action: 'not_required' });

    expect(result.transport_fare).toBeNull();
    expect(result.transport_status).toBe('not_required');
  });
});
