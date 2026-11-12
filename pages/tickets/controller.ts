import { errorMessage } from '@monimesl/dot-runtime';

import { getOrder } from '../../lib/server';
import { loadOrders, saveOrder, withLocal, type SavedOrder, type StoredTicket } from '../../lib/wallet';
import state, { type OrderRow } from './state';

/** What a guest's row says on the right: what's left to do for them, or that it's done. */
function rowStatus(ticket: StoredTicket, index: number, order: SavedOrder): string {
  if (order.claimed) {
    return '';
  }
  if ((ticket.admits ?? 1) > 1) {
    return ticket.sent ? `Admits ${ticket.admits} · shared` : `Admits ${ticket.admits}`;
  }
  if (index === 0) {
    return 'You';
  }
  if (!ticket.holder) {
    return 'Add name';
  }
  return ticket.sent ? 'Sent' : 'Send';
}

export function toRow(order: SavedOrder): OrderRow {
  const tableName = order.tickets.find((ticket) => ticket.tableName)?.tableName ?? '';
  // The buyer's own pass is never one to name or send.
  const guests = order.claimed ? [] : order.tickets.slice(1).filter((ticket) => (ticket.admits ?? 1) === 1);
  const named = guests.filter((ticket) => ticket.holder).length;
  const sent = guests.filter((ticket) => ticket.sent).length;
  const done = named + sent;
  const mixed = new Set(order.tickets.map((ticket) => ticket.ticketId)).size > 1;
  const toName = guests.length - named;
  const toSend = named - sent;
  return {
    orderId: order.orderId,
    title: order.claimed ? order.summary : tableName || order.summary,
    subtitle: order.claimed ? `Sent to you by ${order.from || 'a guest'}` : [tableName ? order.summary.replace(/^1 /, '') : '', order.totalLabel].filter(Boolean).join(' · '),
    summary: order.summary,
    totalLabel: order.totalLabel,
    status: order.status,
    guestCount: guests.length,
    progress: guests.length === 0 ? 100 : Math.round((done / (guests.length * 2)) * 100),
    progressLabel: guests.length === 0 ? '' : toName > 0 ? `${named} of ${guests.length} guests named · ${sent} sent` : toSend > 0 ? `All guests named · ${sent} of ${guests.length} sent` : 'Every guest named and sent',
    tickets: order.tickets.map((ticket, index) => ({
      id: ticket.id,
      title: (ticket.admits ?? 1) > 1 ? 'Table pass' : ticket.holder || `Guest ${index + 1}`,
      subtitle: mixed ? ticket.ticketName : '',
      badge: rowStatus(ticket, index, order),
      index,
    })),
  };
}

/** Paid orders with their tickets, and the ones still waiting on a payment. */
function ordersState(orders: readonly SavedOrder[]) {
  return {
    orders: orders.filter((order) => order.status === 'paid').map(toRow),
    waiting: orders.filter((order) => order.status === 'held' && Date.parse(order.holdUntil) > Date.now()).map(toRow),
    error: '',
  };
}

export default definePage({
  initialState: state,
  hooks: {
    async onShow() {
      await this.actions.load();
    },
    async onRefresh() {
      await this.actions.load();
    },
  },
  actions: {
    async load() {
      try {
        const orders = await loadOrders(this.dash);
        this.setState(ordersState(orders));
        // Payments still pending: the server may have issued the tickets since. Quiet if offline.
        const held = orders.filter((order) => order.status === 'held' && Date.parse(order.holdUntil) > Date.now() - 60 * 60_000);
        for (const order of held) {
          const latest = await getOrder(this.dash, order.orderId, order.orderToken).catch(() => null);
          if (latest && latest.status !== 'held') {
            await saveOrder(this.dash, { ...order, status: latest.status, tickets: withLocal(latest.tickets, order.tickets) }).catch(() => undefined);
          }
        }
        if (held.length > 0) {
          this.setState(ordersState(await loadOrders(this.dash)));
        }
      } catch (error) {
        this.setState({ error: errorMessage(error) || "We couldn't open your tickets." });
      } finally {
        this.setState({ loading: false });
      }
    },
    open(_state, event: DataEvent<{ order: string; index: string }>) {
      this.navigation.push('ticket', { order: event.data.order, index: event.data.index });
    },
    backToEvent() {
      this.navigation.reset('index');
    },
  },
});
