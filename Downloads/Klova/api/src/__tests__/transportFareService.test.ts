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
//
// recordTransportFare now makes 4 DB calls for a 1-keeper booking:
//   1. bookings fetch (guard)          — .single()
//   2. booking_cleaners fetch          — direct await (array)
//   3. bookings update                 — .single()
//   4. booking_cleaners update × n keepers (1 per keeper)

const BOOKING_ID_HAPPY   = 'b-happy-1';
const BOOKING_ID_WAIVE   = 'b-waive-1';
const BOOKING_ID_NOTREQ  = 'b-notreq-1';

// Keeper row returned by booking_cleaners fetch (1-keeper helper)
function oneKeeperChain(keeperId: string = 'bc-row-1') {
  return chain({ data: [{ id: keeperId, cleaner_id: 'cleaner-abc' }], error: null });
}

describe('recordTransportFare — happy path quote (1 keeper)', () => {
  it('stores the fare and sets transport_status to awaiting_payment', async () => {
    const updatedRow = {
      id: BOOKING_ID_HAPPY,
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
      transport_awaiting_since: null,
    };

    vi.mocked(supabase.from)
      .mockReturnValueOnce(                        // 1. guard fetch
        chain({
          data: { id: BOOKING_ID_HAPPY, status: 'confirmed', cleaner_id: 'cleaner-abc', transport_status: 'pending_quote' },
          error: null,
        }) as any,
      )
      .mockReturnValueOnce(oneKeeperChain() as any) // 2. booking_cleaners fetch
      .mockReturnValueOnce(chain({ data: updatedRow, error: null }) as any) // 3. bookings update
      .mockReturnValueOnce(chain({ data: null, error: null }) as any);      // 4. bc update

    const result = await recordTransportFare(BOOKING_ID_HAPPY, { action: 'quote', amount_ngn: 2000 });

    expect(result.transport_fare).toBe(2000);
    expect(result.transport_status).toBe('awaiting_payment');
  });
});

describe('recordTransportFare — happy path waive (1 keeper)', () => {
  it('sets transport_fare to 0 and transport_status to waived', async () => {
    const updatedRow = {
      id: BOOKING_ID_WAIVE,
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
      transport_awaiting_since: null,
    };

    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        chain({
          data: { id: BOOKING_ID_WAIVE, status: 'confirmed', cleaner_id: 'cleaner-xyz', transport_status: 'pending_quote' },
          error: null,
        }) as any,
      )
      .mockReturnValueOnce(oneKeeperChain('bc-waive-1') as any)
      .mockReturnValueOnce(chain({ data: updatedRow, error: null }) as any)
      .mockReturnValueOnce(chain({ data: null, error: null }) as any);

    const result = await recordTransportFare(BOOKING_ID_WAIVE, { action: 'waive' });

    expect(result.transport_fare).toBe(0);
    expect(result.transport_status).toBe('waived');
  });
});

describe('recordTransportFare — happy path not_required (1 keeper)', () => {
  it('sets transport_fare to null and transport_status to not_required', async () => {
    const updatedRow = {
      id: BOOKING_ID_NOTREQ,
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
      transport_awaiting_since: null,
    };

    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        chain({
          data: { id: BOOKING_ID_NOTREQ, status: 'confirmed', cleaner_id: 'cleaner-local', transport_status: 'pending_quote' },
          error: null,
        }) as any,
      )
      .mockReturnValueOnce(oneKeeperChain('bc-notreq-1') as any)
      .mockReturnValueOnce(chain({ data: updatedRow, error: null }) as any)
      .mockReturnValueOnce(chain({ data: null, error: null }) as any);

    const result = await recordTransportFare(BOOKING_ID_NOTREQ, { action: 'not_required' });

    expect(result.transport_fare).toBeNull();
    expect(result.transport_status).toBe('not_required');
  });
});

// ─── 2-keeper fare entry ──────────────────────────────────────────────────────
//
// The key assertions:
//  a) booking.transport_fare (the customer invoice) = SUM of both fares
//  b) booking_cleaners are updated with individual amounts (one per keeper)
//  c) Single amount for a 2-keeper booking is rejected with 400

describe('recordTransportFare — 2-keeper booking: keeper_amounts sets booking.transport_fare to the sum', () => {
  it('invoices the customer for the combined fare and records each keeper amount separately', async () => {
    const BOOKING_ID = 'b-two-keeper-1';
    const LEAD_BC    = 'bc-lead-01';
    const SECOND_BC  = 'bc-second-01';

    const updatedRow = {
      id: BOOKING_ID,
      status: 'confirmed',
      cleaner_id: 'cleaner-lead',
      booking_date: '2026-07-10',
      address: '44 Lekki Phase 1',
      total_amount_kobo: 1_900_000,
      commission_kobo:   418_000,
      transport_fare: 3_500,            // ₦2,000 + ₦1,500 — the combined customer invoice
      transport_status: 'awaiting_payment',
      transport_payment_ref: null,
      transport_paid_at: null,
      transport_awaiting_since: new Date().toISOString(),
    };

    // Two booking_cleaners rows (lead + second)
    const keepersChain = chain({
      data: [
        { id: LEAD_BC,   cleaner_id: 'cleaner-lead'   },
        { id: SECOND_BC, cleaner_id: 'cleaner-second' },
      ],
      error: null,
    });
    const bcUpdateLead   = chain({ data: null, error: null });
    const bcUpdateSecond = chain({ data: null, error: null });

    vi.mocked(supabase.from)
      .mockReturnValueOnce(                                       // 1. booking guard
        chain({
          data: { id: BOOKING_ID, status: 'confirmed', cleaner_id: 'cleaner-lead', transport_status: 'pending_quote' },
          error: null,
        }) as any,
      )
      .mockReturnValueOnce(keepersChain as any)                   // 2. booking_cleaners fetch
      .mockReturnValueOnce(chain({ data: updatedRow, error: null }) as any) // 3. bookings update
      .mockReturnValueOnce(bcUpdateLead as any)                   // 4a. lead bc update
      .mockReturnValueOnce(bcUpdateSecond as any);                // 4b. second bc update

    const result = await recordTransportFare(BOOKING_ID, {
      action: 'quote',
      amount_ngn: 3_500,                 // sum pre-computed by validateTransportFareInput
      keeper_amounts_ngn: [2_000, 1_500],
    });

    // Customer is invoiced for the combined total
    expect(result.transport_fare).toBe(3_500);
    expect(result.transport_status).toBe('awaiting_payment');

    // Lead keeper: 2,000 NGN → 200,000 kobo
    const leadUpdate = bcUpdateLead.update.mock.calls[0][0] as Record<string, unknown>;
    expect(leadUpdate.transport_fare_kobo).toBe(200_000);

    // Second keeper: 1,500 NGN → 150,000 kobo
    const secondUpdate = bcUpdateSecond.update.mock.calls[0][0] as Record<string, unknown>;
    expect(secondUpdate.transport_fare_kobo).toBe(150_000);
  });

  it('rejects a single amount for a 2-keeper booking with 400', async () => {
    const BOOKING_ID = 'b-two-keeper-reject';

    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        chain({
          data: { id: BOOKING_ID, status: 'confirmed', cleaner_id: 'cleaner-lead', transport_status: 'pending_quote' },
          error: null,
        }) as any,
      )
      .mockReturnValueOnce(
        chain({
          data: [
            { id: 'bc-lead',   cleaner_id: 'cleaner-lead'   },
            { id: 'bc-second', cleaner_id: 'cleaner-second' },
          ],
          error: null,
        }) as any,
      );

    // Single amount — no keeper_amounts_ngn — must be rejected
    await expect(
      recordTransportFare(BOOKING_ID, { action: 'quote', amount_ngn: 3_500 }),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('keeper_amounts') });
  });
});

describe('validateTransportFareInput — keeper_amounts', () => {
  it('accepts two amounts and returns total as amount_ngn', () => {
    const result = validateTransportFareInput({ keeper_amounts: [2000, 1500] });
    expect(result).toEqual({ action: 'quote', amount_ngn: 3500, keeper_amounts_ngn: [2000, 1500] });
  });

  it('accepts a single-element keeper_amounts array', () => {
    const result = validateTransportFareInput({ keeper_amounts: [2000] });
    expect(result).toEqual({ action: 'quote', amount_ngn: 2000, keeper_amounts_ngn: [2000] });
  });

  it('rejects when both amount and keeper_amounts are provided', () => {
    expect(() =>
      validateTransportFareInput({ amount: 2000, keeper_amounts: [1000, 1000] }),
    ).toThrow(TransportFareError);
  });

  it('rejects a keeper_amounts array longer than 2', () => {
    expect(() =>
      validateTransportFareInput({ keeper_amounts: [1000, 1000, 500] }),
    ).toThrow(TransportFareError);
  });

  it('rejects a negative amount inside keeper_amounts', () => {
    try {
      validateTransportFareInput({ keeper_amounts: [2000, -100] });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as TransportFareError).status).toBe(422);
    }
  });

  it('rejects a keeper amount above the ceiling', () => {
    try {
      validateTransportFareInput({ keeper_amounts: [5001, 1000] });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as TransportFareError).status).toBe(422);
      expect((err as TransportFareError).message).toMatch(/exceeds/i);
    }
  });
});
