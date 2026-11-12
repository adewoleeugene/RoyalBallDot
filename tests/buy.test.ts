import '@monimesl/dot-runtime/testing';
import { createEvent } from '@monimesl/dot-runtime';
import { testPage } from '@monimesl/dot-runtime/testing';
import { describe, expect, it } from 'vitest';

import buy from '../pages/buy/controller';
import index from '../pages/index/controller';
import { momo, phone } from './phone';

const on = (id: string, detail = {}) => createEvent('change', detail, { id });

describe('event page', () => {
  it('opens the buy page from Get tickets', async () => {
    const page = await testPage(index, { host: phone(momo('completed')).host });
    await page.tap('getTickets');
    expect(page.navigations).toHaveLength(1);
    expect(page.navigations[0]).toMatchObject({ action: 'push', page: 'buy' });
  });
});

describe('buy page', () => {
  it('hides the other ticket types once one is chosen, and shows them again at 0', async () => {
    const page = await testPage(buy, { host: phone(momo('completed')).host });
    expect(page.state.individual.map((row) => row.id)).toEqual(['ordinary', 'vip-single', 'vip-double']);
    await page.dispatch('setQuantity', on('ordinary', { value: 2 }));
    expect(page.state.individual.map((row) => row.id)).toEqual(['ordinary']);
    expect(page.state).toMatchObject({ chosen: true, count: 2, totalLabel: '2 guests · SLE 3,000' });
    await page.dispatch('setQuantity', on('ordinary', { value: 0 }));
    expect(page.state.individual).toHaveLength(3);
    expect(page.state.chosen).toBe(false);
  });

  it('lets a table replace an individual choice, and Choose a different ticket clears it', async () => {
    const page = await testPage(buy, { host: phone(momo('completed')).host });
    await page.dispatch('setQuantity', on('vip-double', { value: 1 }));
    await page.tap('setTab', { value: 'tables' });
    expect(page.state.tables).toHaveLength(3);
    await page.dispatch('chooseTable', on('chambers-table-10'));
    expect(page.state.tables.map((row) => row.id)).toEqual(['chambers-table-10']);
    expect(page.state.individual).toHaveLength(3);
    expect(page.state).toMatchObject({ count: 10, totalLabel: '10 guests · SLE 25,000' });

    await page.tap('checkout');
    expect(page.navigations[0]).toMatchObject({ action: 'push', page: 'checkout', options: { items: 'chambers-table-10:1' } });

    await page.tap('clearChoice');
    expect(page.state).toMatchObject({ chosen: false, count: 0 });
    expect(page.state.tables).toHaveLength(3);
  });
});
