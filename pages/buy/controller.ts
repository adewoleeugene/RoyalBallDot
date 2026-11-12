// Choosing tickets: Individual with a stepper, Tables with one tap. Opened from the event page's
// "Get tickets" button; Continue goes to checkout.
import { errorMessage } from '@monimesl/dot-runtime';

import { chooseOnly, encodeChoice, groups, guestCount, mergeLive, priceLabel, toggleTable, type TicketRow } from '../../lib/event-view';
import { getLiveEvent } from '../../lib/server';
import { loadOrders, paidTickets } from '../../lib/wallet';
import state from './state';

/** The rows, the two lists the page shows, and the footer's count and total. */
function rowsState(tickets: TicketRow[]) {
  const count = tickets.reduce((sum, row) => sum + row.quantity * row.guests, 0);
  const total = tickets.reduce((sum, row) => sum + row.quantity * row.price, 0);
  return { tickets, ...groups(tickets), chosen: count > 0, count, totalLabel: `${guestCount(count)} · ${priceLabel(total)}` };
}

export default definePage({
  initialState: state,
  hooks: {
    async onLoad() {
      await Promise.all([this.actions.loadLive(), this.actions.checkHeld()]);
    },
    // Back from checkout: stock may have moved, and a finished purchase clears the choice.
    async onShow() {
      await Promise.all([this.actions.loadLive(), this.actions.checkHeld()]);
    },
    async onRefresh() {
      await this.actions.loadLive();
    },
  },
  mutations: {
    setTab: (_state, event: ValueEvent) => ({ tab: event.detail.value === 'tables' ? ('tables' as const) : ('individual' as const) }),
    setQuantity: (state, event: DotEvent<{ value: number }, { id: string }>) => rowsState(chooseOnly(state.tickets, event.data.id, event.detail.value)),
    /** "Choose a different ticket": everything shows again. */
    clearChoice: (state) => rowsState(state.tickets.map((row) => ({ ...row, quantity: 0 }))),
    /** A table is chosen with one tap, and only one table per order. */
    chooseTable: (state, event: DataEvent<{ id: string }>) => rowsState(toggleTable(state.tickets, event.data.id)),
  },
  actions: {
    async loadLive() {
      this.setState({ liveError: '' });
      try {
        const live = await getLiveEvent(this.dash);
        this.setState((current) => {
          const tickets = mergeLive(current.tickets, live);
          return { ...rowsState(tickets), sales: live.sales, soldOut: tickets.every((row) => row.soldOut) };
        });
      } catch (error) {
        this.setState({ liveError: errorMessage(error) || "We couldn't reach the ticket desk. Check your connection." });
      } finally {
        this.setState({ loading: false });
      }
    },
    async checkHeld() {
      const orders = await loadOrders(this.dash).catch(() => []);
      const heldCount = paidTickets(orders).length;
      this.setState((current) => {
        // New passes since we last looked: that order is done, so start fresh.
        if (current.heldCount >= 0 && heldCount > current.heldCount) {
          return { heldCount, ...rowsState(current.tickets.map((row) => ({ ...row, quantity: 0 }))) };
        }
        return { heldCount };
      });
    },
    checkout(state) {
      const items = encodeChoice(state.tickets);
      if (items) {
        this.navigation.push('checkout', { items });
      }
    },
  },
});
