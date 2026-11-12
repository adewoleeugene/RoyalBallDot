// The person's orders and tickets, kept on the phone so they show at the gate with no signal.
// The server keeps the real record; this is a copy. Storage isn't backed up, so a new phone
// starts empty until the server can send tickets back (see README.md).
import type { Dash } from '@monimesl/dot-runtime';
import { isDashError } from '@monimesl/dot-runtime';

import type { IssuedTicket } from './server';

/** A pass on this phone: the server's, plus whether this phone sent it on. */
export type StoredTicket = IssuedTicket & { sent?: boolean };

const FILE = 'orders.json';

export type SavedOrder = {
  orderId: string;
  orderToken: string;
  reference: string;
  /** 'held' while the payment is pending; 'paid' once the server issued tickets. */
  status: 'held' | 'paid' | 'expired' | 'cancelled';
  /** Such as "2 Regular, 1 VIP". */
  summary: string;
  totalLabel: string;
  holdUntil: string;
  createdAt: string;
  tickets: StoredTicket[];
  /** A pass someone sent this phone: it can be shown but not renamed or sent on. */
  claimed?: boolean;
  /** For a claimed pass, who bought it. */
  from?: string;
};

export async function loadOrders(dash: Dash): Promise<SavedOrder[]> {
  try {
    const text = await dash.storage.file.read(FILE);
    const parsed = JSON.parse(text) as SavedOrder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (isDashError(error, 'missing')) {
      return [];
    }
    throw error;
  }
}

/** Adds the order, or replaces the one with the same id. */
export async function saveOrder(dash: Dash, order: SavedOrder): Promise<void> {
  const orders = await loadOrders(dash).catch(() => [] as SavedOrder[]);
  const next = [order, ...orders.filter((item) => item.orderId !== order.orderId)];
  await dash.storage.file.write(FILE, JSON.stringify(next));
}

export async function findOrder(dash: Dash, orderId: string): Promise<SavedOrder | null> {
  const orders = await loadOrders(dash);
  return orders.find((order) => order.orderId === orderId) ?? null;
}

/** Replaces one pass in a saved order, keeping the rest. */
export async function updateTicket(dash: Dash, orderId: string, ticket: StoredTicket): Promise<SavedOrder | null> {
  const order = await findOrder(dash, orderId);
  if (!order) {
    return null;
  }
  const next = { ...order, tickets: order.tickets.map((item) => (item.id === ticket.id ? ticket : item)) };
  await saveOrder(dash, next);
  return next;
}

/** Keeps what this phone knows (which passes it sent) when the server sends the tickets again. */
export function withLocal(server: readonly IssuedTicket[], local: readonly StoredTicket[]): StoredTicket[] {
  return server.map((ticket) => ({ ...ticket, sent: local.find((item) => item.id === ticket.id)?.sent ?? false }));
}

/** Passes the person holds, newest order first. */
export function paidTickets(orders: readonly SavedOrder[]): StoredTicket[] {
  return orders.filter((order) => order.status === 'paid').flatMap((order) => order.tickets);
}

export type PassSummary = {
  /** Paid passes on this phone, guests' and the person's own. */
  count: number;
  /** "Your passes · 10 guests", or "Your pass" for one. */
  title: string;
  /** What's left to do, such as "7 not named yet", or "Show them at the door" when nothing is. */
  status: string;
  /** Guests still to name or send. */
  needsAction: boolean;
  /** The order to open with "Show my pass": the only one, or '' to open the list. */
  openOrder: string;
};

/**
 * What the event page says about the passes on this phone. The first pass of each order is the
 * buyer's own, so it never needs naming or sending; a pass someone sent this phone needs neither.
 */
export function passSummary(orders: readonly SavedOrder[]): PassSummary {
  const paid = orders.filter((order) => order.status === 'paid' && order.tickets.length > 0);
  // People, not codes: a table pass counts as everyone it lets in.
  const count = paid.reduce((sum, order) => sum + order.tickets.reduce((n, ticket) => n + (ticket.admits ?? 1), 0), 0);
  // Passes still to name and send: a guest's own pass, never the buyer's or a table's.
  const guests = paid.filter((order) => !order.claimed).flatMap((order) => order.tickets.slice(1)).filter((ticket) => (ticket.admits ?? 1) === 1);
  const unnamed = guests.filter((ticket) => !ticket.holder).length;
  const unsent = guests.filter((ticket) => ticket.holder && !ticket.sent).length;
  const codes = paid.reduce((sum, order) => sum + order.tickets.length, 0);
  let status = codes === 1 ? 'Show it at the door' : 'Show them at the door';
  if (unnamed > 0) {
    status = `${unnamed} not named yet`;
  } else if (unsent > 0) {
    status = unsent === 1 ? '1 named, not sent yet' : `${unsent} named, not sent yet`;
  } else if (guests.length > 0) {
    status = 'Every guest named and sent';
  }
  return {
    count,
    title: count === 1 ? 'Your pass' : `Your passes · ${count} guests`,
    status,
    needsAction: unnamed + unsent > 0,
    openOrder: paid.length === 1 ? paid[0]!.orderId : '',
  };
}
