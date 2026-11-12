import '@monimesl/dot-runtime/testing';
import { describe, expect, it } from 'vitest';

import { isPhone, normalisePhone } from '../lib/buyer';
import { defineEvent } from '../lib/config';
import { configRows, decodeChoice, encodeChoice, mergeLive, salesClosesLabel, toggleTable } from '../lib/event-view';
import { salesState } from '../lib/sales';
import event from '../event.config';

describe('sales window', () => {
  const sales = { opens: '2026-11-01 09:00', closes: '2026-12-19 17:00' };
  it('reads times as Freetown time', () => {
    expect(salesState(sales, new Date('2026-11-01T08:59:00Z'))).toBe('not-yet');
    expect(salesState(sales, new Date('2026-11-01T09:00:00Z'))).toBe('open');
    expect(salesState(sales, new Date('2026-12-19T17:00:00Z'))).toBe('closed');
    expect(salesState(undefined, new Date())).toBe('open');
  });
});

describe('ticket rows', () => {
  it('caps the stepper at what is left and says when few remain', () => {
    const rows = configRows().map((row) => (row.id === 'vip-double' ? { ...row, quantity: 5 } : row));
    const live = {
      sales: 'open' as const,
      tickets: [
        { id: 'ordinary', price: 150000, remaining: 0, maxPerOrder: 10 },
        { id: 'vip-single', price: 320000, remaining: 300, maxPerOrder: 10 },
        { id: 'vip-double', price: 500000, remaining: 3, maxPerOrder: 5 },
        { id: 'chambers-table-10', price: 2500000, remaining: 12, maxPerOrder: 4 },
      ],
    };
    const merged = mergeLive(rows, live);
    expect(merged.find((r) => r.id === 'ordinary')).toMatchObject({ soldOut: true, max: 0 });
    // The server's price wins over the config's.
    expect(merged.find((r) => r.id === 'vip-single')).toMatchObject({ priceLabel: 'SLE 3,200', leftLabel: '' });
    expect(merged.find((r) => r.id === 'vip-double')).toMatchObject({ max: 3, quantity: 3, leftLabel: '3 left' });
    // Plenty left says nothing, and a table is one per order whatever the server allows.
    expect(merged.find((r) => r.id === 'chambers-table-10')).toMatchObject({ max: 1, leftLabel: '' });
  });

  it('shows groups with the price a guest', () => {
    const rows = configRows();
    expect(rows.find((r) => r.id === 'ordinary')).toMatchObject({ kind: 'individual', guests: 1, detail: '' });
    expect(rows.find((r) => r.id === 'vip-double')).toMatchObject({ detail: 'VIP seating · 2 guests · SLE 2,500 a guest' });
    expect(rows.find((r) => r.id === 'chambers-table-10')).toMatchObject({ kind: 'table', max: 1, detail: '10 guests · SLE 2,500 a guest' });
    expect(rows.find((r) => r.id === 'corporate-table-10')).toMatchObject({ detail: '10 guests · SLE 5,000 a guest' });
  });

  it('chooses one ticket type at a time, and un-chooses a table on a second tap', () => {
    const individual = configRows().map((row) => (row.id === 'ordinary' ? { ...row, quantity: 2 } : row));
    expect(toggleTable(individual, 'family-table-5').filter((r) => r.quantity > 0).map((r) => r.id)).toEqual(['family-table-5']);
    const one = toggleTable(configRows(), 'family-table-5');
    const other = toggleTable(one, 'corporate-table-10');
    expect(other.filter((r) => r.quantity > 0).map((r) => r.id)).toEqual(['corporate-table-10']);
    expect(toggleTable(other, 'corporate-table-10').every((r) => r.quantity === 0)).toBe(true);
  });

  it('says when online sales close', () => {
    expect(salesClosesLabel()).toBe('Online sales close Fri 20 Nov at 3 pm');
  });

  it('marks a ticket the server no longer sells as sold out', () => {
    const merged = mergeLive(configRows(), { sales: 'open', tickets: [] });
    expect(merged.every((row) => row.soldOut)).toBe(true);
  });

  it('passes the choice to checkout and drops what it doesn’t know', () => {
    const rows = configRows().map((row) => ({ ...row, quantity: row.id === 'vip-single' ? 2 : 0 }));
    expect(encodeChoice(rows)).toBe('vip-single:2');
    expect(decodeChoice('vip-single:2,ghost:4,vip-double:0,vip-double:x')).toEqual([{ ticketId: 'vip-single', quantity: 2 }]);
  });
});

describe('phone numbers', () => {
  it('accepts the ways people write a Sierra Leone number', () => {
    expect(normalisePhone('076 123456')).toBe('+23276123456');
    expect(normalisePhone('76123456')).toBe('+23276123456');
    expect(normalisePhone('+232 76 123 456')).toBe('+23276123456');
    expect(isPhone('12')).toBe(false);
  });
});

describe('event.config.ts', () => {
  it('is valid', () => {
    expect(() => defineEvent(event)).not.toThrow();
  });
  it('catches a duplicate ticket id or a price that isn’t in cents', () => {
    const ticket = { id: 'regular', name: 'Regular', price: 15000, quantity: 10 };
    expect(() => defineEvent({ ...event, tickets: [ticket, ticket] })).toThrow('Two tickets');
    expect(() => defineEvent({ ...event, tickets: [{ ...ticket, price: 150.5 }] })).toThrow('in cents');
  });
});

describe('event facts', () => {
  it('gives each essential an even two-line title', async () => {
    const { eventFacts, twoLines } = await import('../lib/event-view');
    expect(twoLines('Melian Event Center')).toEqual(['Melian', 'Event Center']);
    expect(twoLines('Royal formal')).toEqual(['Royal', 'formal']);
    expect(eventFacts.facts.map((fact) => [fact.top, fact.bottom, fact.caption])).toEqual([
      ['Friday', '20 Nov', 'From 6 pm'],
      ['Melian', 'Event Center', 'Freetown'],
      ['Royal', 'formal', 'Dress code'],
    ]);
  });
});
