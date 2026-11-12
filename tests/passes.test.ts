import '@monimesl/dot-runtime/testing';
import { createEvent } from '@monimesl/dot-runtime';
import { testPage } from '@monimesl/dot-runtime/testing';
import { describe, expect, it } from 'vitest';

import checkout from '../pages/checkout/controller';
import claim from '../pages/claim/controller';
import ticket from '../pages/ticket/controller';
import { momo, phone } from './phone';

/** Buys a VIP Double on `device` and opens its passes. */
async function buyDouble(device: ReturnType<typeof phone>) {
  const page = await testPage(checkout, { options: { items: 'vip-double:1' }, host: device.host });
  await page.tap('pay');
  const order = page.navigations[0]!.options!.order as string;
  return testPage(ticket, { options: { order }, host: device.host });
}

const tapOn = (id: string) => createEvent('tap', {}, { id });

describe('guest passes', () => {
  it('shows one pass a guest, the buyer named and the guest not yet', async () => {
    const page = await buyDouble(phone(momo('completed', 500000)));
    expect(page.state.canManage).toBe(true);
    expect(page.state.slides.map((slide) => [slide.holderLabel, slide.position])).toEqual([
      ['Mariama Kamara', 'Guest 1 of 2'],
      ['Guest 2 · not named yet', 'Guest 2 of 2'],
    ]);
  });

  it('names a guest on the server and on the phone', async () => {
    const device = phone(momo('completed', 500000));
    const page = await buyDouble(device);
    const guest = page.state.slides[1]!;

    await page.dispatch('editGuest', tapOn(guest.id));
    expect(page.state.editing).toBe(true);
    await page.tap('setEditName', { value: 'A' });
    await page.tap('saveGuest');
    expect(page.state.editNameError).not.toBe('');

    await page.tap('setEditName', { value: 'Fatmata Sesay' });
    await page.tap('setEditPhone', { value: '077 654321' });
    await page.tap('saveGuest');
    expect(page.state.editing).toBe(false);
    expect(page.state.slides[1]).toMatchObject({ holderLabel: 'Fatmata Sesay', named: true });
    const saved = JSON.parse(device.files['orders.json']!)[0].tickets[1];
    expect(saved).toMatchObject({ holder: 'Fatmata Sesay', holderPhone: '+23277654321' });
  });

  it('asks for a name before sending an unnamed pass, then sends it', async () => {
    const page = await buyDouble(phone(momo('completed', 500000)));
    const guest = page.state.slides[1]!;

    await page.dispatch('send', tapOn(guest.id));
    expect(page.state).toMatchObject({ editing: true, sendAfterSave: true });
    expect(page.hostCalls.map((call) => call.method)).not.toContain('dash.system.share');

    await page.tap('setEditName', { value: 'Fatmata Sesay' });
    await page.tap('saveGuest');
    expect(page.hostCalls.map((call) => call.method)).toContain('dash.system.share');
    expect(page.state.slides[1]).toMatchObject({ sent: true });
  });

  it('lets the guest open a sent pass on their own phone, without managing it', async () => {
    const buyer = phone(momo('completed', 500000));
    const page = await buyDouble(buyer);
    const pass = JSON.parse(buyer.files['orders.json']!)[0].tickets[1];

    const guestPhone = phone(momo('completed'));
    const opened = await testPage(claim, { options: { pass: pass.id, key: pass.claimKey }, host: guestPhone.host });
    expect(opened.navigations).toEqual([{ action: 'replace', page: 'ticket', options: { order: `pass-${pass.id}` } }]);

    const shown = await testPage(ticket, { options: { order: `pass-${pass.id}` }, host: guestPhone.host });
    expect(shown.state).toMatchObject({ canManage: false, fromLabel: 'Sent to you by Mariama Kamara' });
    expect(shown.state.slides).toHaveLength(1);
    expect(shown.state.slides[0]!.code).toBe(pass.code);
    expect(page.state.slides).toHaveLength(2);
  });

  it('still names a guest after the demo server restarts and forgets the order', async () => {
    const device = phone(momo('completed'));
    const ticketOf = (n: number, holder: string) => ({ id: `p-old-${n}`, code: `DEMO:p-old-${n}`, ticketId: 'chambers-table-10', ticketName: 'Chambers Table of 10', holder, holderPhone: '', guestNumber: n, guestCount: 10, tableName: 'Tejan-Cole Chambers', claimKey: 'k' });
    device.files['orders.json'] = JSON.stringify([
      { orderId: 'demo-forgotten', orderToken: 'demo', reference: 'r', status: 'paid', summary: '1 Chambers Table of 10', totalLabel: 'SLE 25,000', holdUntil: '', createdAt: '', tickets: [ticketOf(1, 'Mariama Kamara'), ticketOf(2, '')] },
    ]);
    const page = await testPage(ticket, { options: { order: 'demo-forgotten' }, host: device.host });
    await page.dispatch('editGuest', tapOn('p-old-2'));
    await page.tap('setEditName', { value: 'test' });
    await page.tap('saveGuest');
    expect(page.state).toMatchObject({ editing: false, sheetNote: '' });
    expect(page.state.slides[1]).toMatchObject({ holderLabel: 'test', named: true });
  });

  it('shares a table pass without asking for a name, and every table member gets the same code', async () => {
    const buyer = phone(momo('completed', 2500000));
    const bought = await testPage(checkout, { options: { items: 'chambers-table-10:1' }, host: buyer.host });
    await bought.tap('setTableName', { value: 'Tejan-Cole Chambers' });
    await bought.tap('pay');
    const order = bought.navigations[0]!.options!.order as string;
    const page = await testPage(ticket, { options: { order }, host: buyer.host });
    expect(page.state.slides).toHaveLength(1);
    expect(page.state.slides[0]).toMatchObject({ tablePass: true, holderLabel: 'Tejan-Cole Chambers', position: 'Admits 10' });

    await page.dispatch('send', tapOn(page.state.slides[0]!.id));
    expect(page.state.editing).toBe(false);
    expect(page.hostCalls.map((call) => call.method)).toContain('dash.system.share');
    expect(page.state.slides[0]!.sent).toBe(true);

    const pass = JSON.parse(buyer.files['orders.json']!)[0].tickets[0];
    for (const member of [phone(momo('completed')), phone(momo('completed'))]) {
      await testPage(claim, { options: { pass: pass.id, key: pass.claimKey }, host: member.host });
      const shown = await testPage(ticket, { options: { order: `pass-${pass.id}` }, host: member.host });
      expect(shown.state).toMatchObject({ canManage: false });
      expect(shown.state.slides[0]).toMatchObject({ code: pass.code, tablePass: true });
    }
  });

  it('turns away a pass link with the wrong key', async () => {
    const buyer = phone(momo('completed', 500000));
    await buyDouble(buyer);
    const pass = JSON.parse(buyer.files['orders.json']!)[0].tickets[1];
    const opened = await testPage(claim, { options: { pass: pass.id, key: 'wrong' }, host: phone(momo('completed')).host });
    expect(opened.navigations).toEqual([]);
    expect(opened.state.error).toContain('doesn’t work');
  });
});
