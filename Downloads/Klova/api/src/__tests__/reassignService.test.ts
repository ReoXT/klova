import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { supabase } from '../lib/supabase';
import { reassignKeeper, transferKeeperEarning, ReassignError } from '../services/reassignService';

// ─── Mock builder ─────────────────────────────────────────────────────────────

function chain(result: { data: unknown; error: unknown }) {
  const b: any = {};
  b.then = (resolve: (v: any) => any) => Promise.resolve(result).then(resolve);
  for (const m of ['select', 'eq', 'insert', 'delete', 'update', 'maybeSingle', 'single']) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  return b;
}

function q(data: unknown, error: unknown = null) {
  return chain({ data, error });
}

const mockRpc = () => vi.mocked(supabase.rpc);
const mockFrom = () => vi.mocked(supabase.from);

beforeEach(() => vi.clearAllMocks());

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const BK_ID     = 'booking-uuid-001';
const OLD_C     = 'cleaner-old-001';
const NEW_C     = 'cleaner-new-002';
const OTHER_C   = 'cleaner-other-003';
const EARN_ID   = 'earn-row-001';
const DATE      = '2026-07-15';

// ─── transferKeeperEarning ─────────────────────────────────────────────────────

describe('transferKeeperEarning', () => {
  it('returns false when no earnings row exists for old keeper', async () => {
    const fromMock = q(null);
    mockFrom().mockReturnValue(fromMock);

    const result = await transferKeeperEarning(BK_ID, OLD_C, NEW_C);

    expect(result).toBe(false);
    expect(mockFrom()).toHaveBeenCalledWith('cleaner_earnings');
  });

  it('returns false (no-op) when old earning is already paid', async () => {
    const existingEarning = { id: EARN_ID, earning_kobo: 5000_00, status: 'paid' };
    const fromMock = q(existingEarning);
    mockFrom().mockReturnValue(fromMock);

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await transferKeeperEarning(BK_ID, OLD_C, NEW_C);
    consoleSpy.mockRestore();

    expect(result).toBe(false);
  });

  it('deletes old row and inserts new row with same amount and status for unpaid earning', async () => {
    const existingEarning = { id: EARN_ID, earning_kobo: 7400_00, status: 'unpaid' };

    const selectChain = q(existingEarning);
    const deleteChain = q(null);
    const insertChain = q(null);

    mockFrom()
      .mockReturnValueOnce(selectChain)  // select old earning
      .mockReturnValueOnce(deleteChain)  // delete old row
      .mockReturnValueOnce(insertChain); // insert new row

    const result = await transferKeeperEarning(BK_ID, OLD_C, NEW_C);

    expect(result).toBe(true);

    // Verify insert was called with correct shape
    const insertArg = insertChain.insert.mock.calls[0]?.[0];
    expect(insertArg).toMatchObject({
      booking_id:   BK_ID,
      cleaner_id:   NEW_C,
      earning_kobo: 7400_00,
      status:       'unpaid',
    });
  });

  it('transfers a refunded earning row correctly', async () => {
    const existingEarning = { id: EARN_ID, earning_kobo: 0, status: 'refunded' };

    const selectChain = q(existingEarning);
    const deleteChain = q(null);
    const insertChain = q(null);

    mockFrom()
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(deleteChain)
      .mockReturnValueOnce(insertChain);

    const result = await transferKeeperEarning(BK_ID, OLD_C, NEW_C);

    expect(result).toBe(true);
    expect(insertChain.insert.mock.calls[0]?.[0]).toMatchObject({
      cleaner_id:   NEW_C,
      earning_kobo: 0,
      status:       'refunded',
    });
  });
});

// ─── reassignKeeper ────────────────────────────────────────────────────────────

describe('reassignKeeper', () => {
  function setupBooking(status: string) {
    const bookingChain = q({ booking_date: DATE, status, cleaner_id: OLD_C });
    const bcChain = q({ cleaner_id: OLD_C }); // existing bc row for role='lead'
    mockFrom()
      .mockReturnValueOnce(bookingChain)  // booking select
      .mockReturnValueOnce(bcChain);      // booking_cleaners select
    return bookingChain;
  }

  it('throws 404 when booking not found', async () => {
    const notFoundChain = q(null, { message: 'Not found', code: 'PGRST116', details: '', hint: '' });
    mockFrom().mockReturnValue(notFoundChain);

    await expect(reassignKeeper(BK_ID, 'lead', NEW_C)).rejects.toBeInstanceOf(ReassignError);
    await expect(reassignKeeper(BK_ID, 'lead', NEW_C)).rejects.toMatchObject({ status: 404 });
  });

  it('throws 422 for a cancelled booking', async () => {
    // Need separate mock per call since mockReturnValue is shared
    const cancelledChain = q({ booking_date: DATE, status: 'cancelled', cleaner_id: OLD_C });
    mockFrom().mockReturnValue(cancelledChain);

    await expect(reassignKeeper(BK_ID, 'lead', NEW_C)).rejects.toMatchObject({ status: 422 });
  });

  it('throws 409 when RPC signals cleaner_unavailable', async () => {
    setupBooking('confirmed');
    mockRpc().mockResolvedValue({ data: null, error: { message: 'cleaner_unavailable' } } as any);

    await expect(reassignKeeper(BK_ID, 'lead', NEW_C)).rejects.toMatchObject({ status: 409 });
  });

  it('throws 422 when RPC signals duplicate_keeper', async () => {
    setupBooking('confirmed');
    mockRpc().mockResolvedValue({ data: null, error: { message: 'duplicate_keeper' } } as any);

    await expect(reassignKeeper(BK_ID, 'lead', NEW_C)).rejects.toMatchObject({ status: 422 });
  });

  it('calls admin_reassign_keeper RPC with correct args for lead role', async () => {
    setupBooking('confirmed');
    mockRpc().mockResolvedValue({ data: `reassigned:lead:${NEW_C}`, error: null } as any);

    const result = await reassignKeeper(BK_ID, 'lead', NEW_C);

    expect(mockRpc()).toHaveBeenCalledWith('admin_reassign_keeper', {
      p_booking_id:     BK_ID,
      p_role:           'lead',
      p_new_cleaner_id: NEW_C,
      p_booking_date:   DATE,
    });
    expect(result.rpc_result).toContain('reassigned:lead');
    expect(result.earnings_transferred).toBe(false); // confirmed, not completed
  });

  it('calls admin_reassign_keeper for second-keeper reassignment', async () => {
    const bookingChain = q({ booking_date: DATE, status: 'confirmed', cleaner_id: OLD_C });
    const bcChain = q({ cleaner_id: OTHER_C }); // second keeper
    mockFrom()
      .mockReturnValueOnce(bookingChain)
      .mockReturnValueOnce(bcChain);
    mockRpc().mockResolvedValue({ data: `reassigned:second:${NEW_C}`, error: null } as any);

    const result = await reassignKeeper(BK_ID, 'second', NEW_C);

    expect(mockRpc()).toHaveBeenCalledWith('admin_reassign_keeper', expect.objectContaining({
      p_role: 'second',
      p_new_cleaner_id: NEW_C,
    }));
    expect(result.earnings_transferred).toBe(false);
  });

  it('transfers earnings when reassigning a keeper on a completed booking', async () => {
    const bookingChain = q({ booking_date: DATE, status: 'completed', cleaner_id: OLD_C });
    const bcChain = q({ cleaner_id: OLD_C });
    const earnChain = q({ id: EARN_ID, earning_kobo: 9_000_00, status: 'unpaid' });
    const deleteChain = q(null);
    const insertChain = q(null);

    mockFrom()
      .mockReturnValueOnce(bookingChain)  // booking
      .mockReturnValueOnce(bcChain)       // booking_cleaners (get old cleaner_id)
      .mockReturnValueOnce(earnChain)     // cleaner_earnings select
      .mockReturnValueOnce(deleteChain)   // delete old earning
      .mockReturnValueOnce(insertChain);  // insert new earning

    mockRpc().mockResolvedValue({ data: `reassigned:lead:${NEW_C}`, error: null } as any);

    const result = await reassignKeeper(BK_ID, 'lead', NEW_C);

    expect(result.earnings_transferred).toBe(true);

    // New row should go to the new cleaner with same amount
    const insertedRow = insertChain.insert.mock.calls[0]?.[0];
    expect(insertedRow).toMatchObject({
      booking_id:   BK_ID,
      cleaner_id:   NEW_C,
      earning_kobo: 9_000_00,
      status:       'unpaid',
    });
  });

  it('does NOT transfer earnings when old and new cleaner are the same', async () => {
    const bookingChain = q({ booking_date: DATE, status: 'completed', cleaner_id: OLD_C });
    const bcChain = q({ cleaner_id: OLD_C }); // same cleaner as NEW_C in this test
    mockFrom()
      .mockReturnValueOnce(bookingChain)
      .mockReturnValueOnce(bcChain);
    mockRpc().mockResolvedValue({ data: `reassigned:lead:${OLD_C}`, error: null } as any);

    const result = await reassignKeeper(BK_ID, 'lead', OLD_C /* same as old */);

    expect(result.earnings_transferred).toBe(false);
    // from should only have been called twice (booking + bc), NOT for earnings
    expect(mockFrom()).toHaveBeenCalledTimes(2);
  });
});
