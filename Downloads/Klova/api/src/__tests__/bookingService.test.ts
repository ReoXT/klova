import { describe, it, expect } from 'vitest';
import { validateBookingInput, FieldValidationError } from '../services/bookingService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns a valid booking body, spread in overrides to create invalid cases. */
function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const dateStr = tomorrow.toISOString().slice(0, 10); // YYYY-MM-DD

  return {
    first_name: 'Amara',
    last_name: 'Obi',
    phone: '08012345678',
    address: '14 Admiralty Way, Lekki Phase 1',
    zone_slug: 'lekki-ajah',
    service_slug: 'standard',
    bedrooms: '2',
    addon_slugs: [],
    booking_date: dateStr,
    ...overrides,
  };
}

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('validateBookingInput — valid body', () => {
  it('returns a clean BookingInput when all fields are valid', () => {
    const result = validateBookingInput(validBody());
    expect(result.first_name).toBe('Amara');
    expect(result.last_name).toBe('Obi');
    expect(result.addon_slugs).toEqual([]);
    expect(result.email).toBeUndefined();
    expect(result.requested_cleaner_id).toBeUndefined();
  });

  it('trims whitespace from string fields', () => {
    const result = validateBookingInput(validBody({ first_name: '  Tunde  ', last_name: '  Adeyemi  ' }));
    expect(result.first_name).toBe('Tunde');
    expect(result.last_name).toBe('Adeyemi');
  });
});

// ─── Missing required fields ──────────────────────────────────────────────────

describe('validateBookingInput — missing required fields', () => {
  it('reports every missing required field at once', () => {
    expect(() => validateBookingInput({})).toThrow(FieldValidationError);

    try {
      validateBookingInput({});
    } catch (err) {
      expect(err).toBeInstanceOf(FieldValidationError);
      const e = err as FieldValidationError;
      expect(e.status).toBe(400);
      expect(e.fields).toHaveProperty('first_name');
      expect(e.fields).toHaveProperty('last_name');
      expect(e.fields).toHaveProperty('phone');
      expect(e.fields).toHaveProperty('address');
      expect(e.fields).toHaveProperty('zone_slug');
      expect(e.fields).toHaveProperty('service_slug');
      expect(e.fields).toHaveProperty('bedrooms');
      expect(e.fields).toHaveProperty('booking_date');
    }
  });

  it('reports only the missing field when everything else is present', () => {
    const body = validBody({ phone: '' });
    try {
      validateBookingInput(body);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(FieldValidationError);
      const e = err as FieldValidationError;
      expect(Object.keys(e.fields)).toEqual(['phone']);
      expect(e.fields.phone).toMatch(/required/i);
    }
  });

  it('treats a whitespace-only string as missing', () => {
    const body = validBody({ address: '   ' });
    expect(() => validateBookingInput(body)).toThrow(FieldValidationError);
  });
});

// ─── Date validation ──────────────────────────────────────────────────────────

describe('validateBookingInput — booking_date', () => {
  it('rejects a date in the past', () => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const body = validBody({ booking_date: yesterday.toISOString().slice(0, 10) });

    try {
      validateBookingInput(body);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(FieldValidationError);
      const e = err as FieldValidationError;
      expect(e.fields.booking_date).toMatch(/past/i);
    }
  });

  it('rejects a non-date string', () => {
    const body = validBody({ booking_date: 'next-friday' });
    try {
      validateBookingInput(body);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(FieldValidationError);
      const e = err as FieldValidationError;
      expect(e.fields.booking_date).toMatch(/invalid/i);
    }
  });

  it('accepts today as a valid date', () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const body = validBody({ booking_date: today.toISOString().slice(0, 10) });
    expect(() => validateBookingInput(body)).not.toThrow();
  });

  it('accepts a future date', () => {
    const body = validBody(); // helper already sets tomorrow
    expect(() => validateBookingInput(body)).not.toThrow();
  });
});

// ─── Optional fields ──────────────────────────────────────────────────────────

describe('validateBookingInput — optional fields', () => {
  it('accepts a booking with no add-ons (defaults to [])', () => {
    const body = validBody({ addon_slugs: undefined });
    const result = validateBookingInput(body);
    expect(result.addon_slugs).toEqual([]);
  });

  it('accepts email when provided', () => {
    const result = validateBookingInput(validBody({ email: 'amara@example.com' }));
    expect(result.email).toBe('amara@example.com');
  });

  it('accepts requested_cleaner_id when provided', () => {
    const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const result = validateBookingInput(validBody({ requested_cleaner_id: id }));
    expect(result.requested_cleaner_id).toBe(id);
  });
});
