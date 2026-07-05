import { describe, it, expect } from 'vitest';
import {
  customerDispatchConfirmedMsg,
  type BookingNotifContext,
} from '../lib/messageTemplates';

const BASE_CTX: BookingNotifContext = {
  bookingId:         'bk-test-001',
  customerFirstName: 'Bisi',
  customerLastName:  'Ade',
  customerPhone:     '08011111111',
  cleanerFirstName:  'Tunde',
  cleanerLastName:   'Ola',
  cleanerPhone:      '08022222222',
  cleanerEmail:      'tunde@example.com',
  serviceName:       'Standard Clean',
  zoneName:          'Lekki-Ajah',
  bookingDate:       'Wednesday, 25 June',
  address:           '5 Palm Ave, Lekki',
  totalAmountNgn:    9500,
};

describe('customerDispatchConfirmedMsg', () => {
  it('names the single (lead) keeper when allKeeperFirstNames is omitted', () => {
    const msg = customerDispatchConfirmedMsg(BASE_CTX);
    expect(msg).toContain('Tunde will be with you');
    expect(msg).toContain('Bisi');
    expect(msg).toContain('Wednesday, 25 June');
    expect(msg).toContain('Standard Clean');
  });

  it('names the single keeper when allKeeperFirstNames has one entry', () => {
    const msg = customerDispatchConfirmedMsg(BASE_CTX, ['Tunde']);
    expect(msg).toContain('Tunde will be with you');
    expect(msg).not.toContain(' and ');
  });

  it('names both keepers joined with "and" for a 2-keeper booking', () => {
    const msg = customerDispatchConfirmedMsg(BASE_CTX, ['Tunde', 'Amaka']);
    expect(msg).toContain('Tunde and Amaka will be with you');
    expect(msg).toContain('Bisi');
    expect(msg).toContain('Standard Clean');
    expect(msg).toContain('Wednesday, 25 June');
  });

  it('falls back to cleanerFirstName when allKeeperFirstNames is an empty array', () => {
    const msg = customerDispatchConfirmedMsg(BASE_CTX, []);
    expect(msg).toContain('Tunde will be with you');
  });
});
