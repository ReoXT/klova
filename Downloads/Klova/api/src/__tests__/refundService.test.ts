import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../config', () => ({
  config: { paystackSecretKey: 'sk_test_fake' },
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

// adjustEarningForRefund is called at the end of issueRefund; isolate it here
// so the refund tests don't need to mock the full cleaner_earnings chain.
vi.mock('../services/earningsService', () => ({
  adjustEarningForRefund: vi.fn().mockResolvedValue(undefined),
}));

import { supabase } from '../lib/supabase';
import { issueRefund } from '../services/refundService';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

// Builds a fluent chain that is both thenable (for update) and has .single()
// (for select). Every builder method returns the same chain.
function makeChain(result: object) {
  const b: any = {};
  b.then = (resolve: (v: any) => any, reject?: (v: any) => any) =>
    Promise.resolve(result).then(resolve, reject);
  b.catch = (fn: (v: any) => any) => Promise.resolve(result).catch(fn);
  b.single = vi.fn().mockResolvedValue(result);
  for (const m of ['select', 'eq', 'update']) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  return b;
}

// Mocks two sequential supabase.from() calls: first = SELECT, second = UPDATE.
function setupBookingMock(
  row: Record<string, unknown> | null,
  updateError: unknown = null,
) {
  const selectResult = { data: row, error: row ? null : { message: 'not found' } };
  const updateResult = { data: null, error: updateError };

  const selectChain = makeChain(selectResult);
  const updateChain = makeChain(updateResult);

  let call = 0;
  vi.mocked(supabase.from).mockImplementation(() => {
    call++;
    return call === 1 ? selectChain : updateChain;
  });
}

function mockFetch(ok: boolean, body: object) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 400,
      json: vi.fn().mockResolvedValue(body),
    }),
  );
}

const BOOKING_ID = 'booking-uuid-001';
const REFERENCE = 'txn_abc123';

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

// ─── Guard: never paid ────────────────────────────────────────────────────────

describe('issueRefund — guard: never paid', () => {
  it('skips without calling Paystack if paystack_reference is null', async () => {
    setupBookingMock({ id: BOOKING_ID, paystack_reference: null, refunded_at: null });
    mockFetch(true, { status: true, message: 'Refund queued' });

    await issueRefund(BOOKING_ID, REFERENCE);

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});

// ─── Guard: double-refund ─────────────────────────────────────────────────────
//
// The guard fires when refund_kobo >= total_amount_kobo (a full refund was
// already recorded). This protects against double-refunds if the webhook fires
// twice or the admin triggers a second refund.

describe('issueRefund — guard: already refunded', () => {
  it('skips without calling Paystack when refund_kobo equals total_amount_kobo', async () => {
    setupBookingMock({
      id: BOOKING_ID,
      paystack_reference: REFERENCE,
      refunded_at: '2026-06-18T10:00:00.000Z',
      total_amount_kobo: 500_000,
      refund_kobo: 500_000, // already fully refunded
    });
    mockFetch(true, { status: true, message: 'Refund queued' });

    await issueRefund(BOOKING_ID, REFERENCE);

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});

// ─── Guard: booking not found ─────────────────────────────────────────────────

describe('issueRefund — guard: booking not found', () => {
  it('skips without throwing if the booking does not exist', async () => {
    setupBookingMock(null);
    mockFetch(true, { status: true, message: 'Refund queued' });

    await expect(issueRefund(BOOKING_ID, REFERENCE)).resolves.toBeUndefined();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('issueRefund — success', () => {
  it('calls Paystack refund API with the correct reference and records the refund', async () => {
    setupBookingMock({
      id: BOOKING_ID,
      paystack_reference: REFERENCE,
      refunded_at: null,
      total_amount_kobo: 500_000,
      refund_kobo: 0,
    });
    mockFetch(true, { status: true, message: 'Refund queued' });

    await issueRefund(BOOKING_ID, REFERENCE);

    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
    const [url, opts] = (vi.mocked(fetch) as any).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.paystack.co/refund');
    expect(JSON.parse(opts.body as string)).toEqual({ transaction: REFERENCE });

    // Two supabase.from() calls: SELECT (guard check) + UPDATE (set refunded_at + refund_kobo).
    // adjustEarningForRefund is mocked so it does not add a third call.
    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(2);
  });
});

// ─── Paystack error ───────────────────────────────────────────────────────────

describe('issueRefund — Paystack API failure', () => {
  it('throws so the webhook handler returns 500 and Paystack retries', async () => {
    setupBookingMock({ id: BOOKING_ID, paystack_reference: REFERENCE, refunded_at: null });
    mockFetch(false, { status: false, message: 'Invalid transaction reference' });

    await expect(issueRefund(BOOKING_ID, REFERENCE)).rejects.toThrow('Refund failed');
  });
});
