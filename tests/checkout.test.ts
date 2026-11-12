import '@monimesl/dot-runtime/testing';
import { DashError } from '@monimesl/dot-runtime';
import { testPage } from '@monimesl/dot-runtime/testing';
import { describe, expect, it } from 'vitest';

import checkout from '../pages/checkout/controller';
import { momo, phone } from './phone';

const options = { items: 'ordinary:2,vip-single:1' };

describe('checkout', () => {
  it('shows the order from the chosen tickets', async () => {
    const page = await testPage(checkout, { options, host: phone(momo('completed')).host });
    expect(page.state.lines).toEqual([
      { id: 'ordinary', label: '2 × Ordinary', meta: '2 guests', amountLabel: 'SLE 3,000' },
      { id: 'vip-single', label: 'VIP Single', meta: '1 guest', amountLabel: 'SLE 3,000' },
    ]);
    expect(page.state.totalLabel).toBe('SLE 6,000');
    expect(page.state).toMatchObject({ count: 3, countLabel: '3 guests', hasTable: false });
  });

  it('pays, saves the tickets and opens them in place of checkout', async () => {
    const device = phone(momo('completed'));
    const page = await testPage(checkout, { options, host: device.host });
    await page.tap('pay');

    expect(page.navigations).toEqual([{ action: 'replace', page: 'ticket', options: { order: page.state.orderId } }]);
    const saved = JSON.parse(device.files['orders.json']!);
    expect(saved[0]).toMatchObject({ status: 'paid', summary: '2 Ordinary, 1 VIP Single', totalLabel: 'SLE 6,000' });
    expect(saved[0].tickets).toHaveLength(3);
    // The buyer's pass carries their name; the guests are named after paying.
    expect(saved[0].tickets[0]).toMatchObject({ ticketName: 'Ordinary', holder: 'Mariama Kamara' });
    expect(saved[0].tickets[1]).toMatchObject({ ticketName: 'Ordinary', holder: '' });
  });

  it('asks for the table card name before a table is paid, then gives one pass for the whole table', async () => {
    const device = phone(momo('completed', 2500000));
    const page = await testPage(checkout, { options: { items: 'chambers-table-10:1' }, host: device.host });
    expect(page.state).toMatchObject({ hasTable: true, countLabel: '10 guests' });
    expect(page.state.lines).toEqual([{ id: 'chambers-table-10', label: 'Chambers Table of 10', meta: '10 guests', amountLabel: 'SLE 25,000' }]);

    await page.tap('pay');
    expect(page.state.tableError).not.toBe('');
    expect(page.hostCalls.map((call) => call.method)).not.toContain('dash.payments.request');

    await page.tap('setTableName', { value: 'Tejan-Cole Chambers' });
    await page.tap('pay');
    expect(page.navigations[0]).toMatchObject({ action: 'replace', page: 'ticket' });
    const passes = JSON.parse(device.files['orders.json']!)[0].tickets;
    expect(passes).toHaveLength(1);
    expect(passes[0]).toMatchObject({ holder: 'Mariama Kamara', admits: 10, tableName: 'Tejan-Cole Chambers' });
  });

  it('waits on a pending payment, then opens the tickets once it completes', async () => {
    let status = 'pending';
    const device = phone(momo('pending'), { 'dash.payments.get': () => momo(status)() });
    const page = await testPage(checkout, { options, host: device.host });
    await page.tap('pay');
    expect(page.state.stage).toBe('pending');
    expect(page.navigations).toEqual([]);

    status = 'completed';
    await page.show();
    expect(page.navigations).toEqual([{ action: 'replace', page: 'ticket', options: { order: page.state.orderId } }]);
  });

  it('starts over with a new order when a pending payment fails', async () => {
    const device = phone(momo('pending'), { 'dash.payments.get': () => momo('failed')() });
    const page = await testPage(checkout, { options, host: device.host });
    const firstKey = page.state.orderKey;
    await page.tap('pay');
    await page.tap('checkAgain');
    expect(page.state).toMatchObject({ stage: 'review', orderId: '', note: "The payment didn't go through. You haven't been charged." });
    expect(page.state.orderKey).not.toBe(firstKey);
  });

  it('says nothing when the person closes the payment sheet', async () => {
    const page = await testPage(checkout, {
      options,
      host: phone(() => {
        throw new DashError('cancelled', 'Closed');
      }).host,
    });
    await page.tap('pay');
    expect(page.state).toMatchObject({ stage: 'review', note: '' });
  });

  it('explains when the dot can’t take payments', async () => {
    const page = await testPage(checkout, {
      options,
      host: phone(() => {
        throw new DashError('denied', 'Not published');
      }).host,
    });
    await page.tap('pay');
    expect(page.state.stage).toBe('review');
    expect(page.state.note).toContain("can't take payments");
  });

  it('asks for a name and number when the person won’t share them, and doesn’t charge', async () => {
    const device = phone(momo('completed'), {
      'dash.account.signIn': () => {
        throw new DashError('denied', 'No');
      },
    });
    const page = await testPage(checkout, { options, host: device.host });
    await page.tap('pay');
    expect(page.state.typing).toBe(true);
    expect(page.hostCalls.map((call) => call.method)).not.toContain('dash.payments.request');

    await page.tap('setName', { value: 'Abu Bangura' });
    await page.tap('setPhone', { value: '12' });
    await page.tap('pay');
    expect(page.state.phoneError).not.toBe('');
    expect(page.hostCalls.map((call) => call.method)).not.toContain('dash.payments.request');

    await page.tap('setPhone', { value: '076 123456' });
    await page.tap('pay');
    expect(page.navigations[0]).toMatchObject({ action: 'replace', page: 'ticket' });
    const saved = JSON.parse(device.files['orders.json']!);
    expect(saved[0].tickets[0].holder).toBe('Abu Bangura');
  });
});
