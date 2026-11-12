import '@monimesl/dot-runtime/testing';
import { testPage } from '@monimesl/dot-runtime/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { isEventDay } from '../lib/sales';
import { passSummary, type SavedOrder, type StoredTicket } from '../lib/wallet';
import index from '../pages/index/controller';
import { momo, phone } from './phone';

function pass(holder: string, sent = false): StoredTicket {
  return { id: `p-${holder || Math.random()}`, code: 'DEMO:x', ticketId: 'vip-double', ticketName: 'VIP Double', holder, holderPhone: '', guestNumber: 1, guestCount: 2, tableName: '', claimKey: 'k', sent };
}

function order(tickets: StoredTicket[], extra: Partial<SavedOrder> = {}): SavedOrder {
  return { orderId: 'o-1', orderToken: 't', reference: 'r', status: 'paid', summary: '', totalLabel: '', holdUntil: '', createdAt: '', tickets, ...extra };
}

describe('the passes card', () => {
  it('says how many guests are still to name, then to send, then that all is done', () => {
    expect(passSummary([order([pass('Mariama Kamara'), pass(''), pass('')])])).toMatchObject({
      title: 'Your passes · 3 guests',
      status: '2 not named yet',
      needsAction: true,
      openOrder: 'o-1',
    });
    expect(passSummary([order([pass('Mariama Kamara'), pass('Abu'), pass('Fatmata', true)])]).status).toBe('1 named, not sent yet');
    expect(passSummary([order([pass('Mariama Kamara'), pass('Abu', true)])])).toMatchObject({ status: 'Every guest named and sent', needsAction: false });
  });

  it('counts a table pass as everyone it lets in, with nothing to name', () => {
    const tablePass = { ...pass('Mariama Kamara'), admits: 10, tableName: 'Tejan-Cole Chambers' };
    expect(passSummary([order([tablePass])])).toMatchObject({ title: 'Your passes · 10 guests', status: 'Show it at the door', needsAction: false });
  });

  it('asks nothing of a lone pass or one a guest was sent, and opens the list for several orders', () => {
    expect(passSummary([order([pass('Mariama Kamara')])])).toMatchObject({ title: 'Your pass', status: 'Show it at the door', needsAction: false });
    expect(passSummary([order([pass('')], { claimed: true })]).needsAction).toBe(false);
    expect(passSummary([order([pass('A')]), order([pass('B')], { orderId: 'o-2' })]).openOrder).toBe('');
  });
});

describe('the day of the ball', () => {
  afterEach(() => vi.useRealTimers());

  it('knows the day in Freetown time', () => {
    expect(isEventDay('2026-11-20', undefined, new Date('2026-11-19T23:59:00Z'))).toBe(false);
    expect(isEventDay('2026-11-20', undefined, new Date('2026-11-20T18:00:00Z'))).toBe(true);
  });

  it('opens the pass straight from the main button', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T17:00:00Z'));
    const device = phone(momo('completed'));
    device.files['orders.json'] = JSON.stringify([order([pass('Mariama Kamara')])]);
    const page = await testPage(index, { host: device.host });
    expect(page.state).toMatchObject({ eventDay: true, heldCount: 1, heldOrder: 'o-1' });
    await page.tap('showPass');
    expect(page.navigations[0]).toMatchObject({ action: 'push', page: 'ticket', options: { order: 'o-1' } });
  });
});

describe('the passes screen', () => {
  it('folds a table into one card with its progress and a status on each guest', async () => {
    const { toRow } = await import('../pages/tickets/controller');
    const table = (holder: string, sent = false): StoredTicket => ({ ...pass(holder, sent), ticketId: 'chambers-table-10', ticketName: 'Chambers Table of 10', tableName: 'Tejan-Cole Chambers', guestCount: 10 });
    const row = toRow(order([table('Mariama Kamara', true), table('Abu', true), table('Fatmata'), table(''), table('')], { summary: '1 Chambers Table of 10', totalLabel: 'SLE 25,000' }));
    expect(row).toMatchObject({
      title: 'Tejan-Cole Chambers',
      subtitle: 'Chambers Table of 10 · SLE 25,000',
      guestCount: 4,
      progressLabel: '2 of 4 guests named · 1 sent',
    });
    expect(row.tickets.map((ticket) => [ticket.title, ticket.badge])).toEqual([
      ['Mariama Kamara', 'You'],
      ['Abu', 'Sent'],
      ['Fatmata', 'Send'],
      ['Guest 4', 'Add name'],
      ['Guest 5', 'Add name'],
    ]);
  });
});
