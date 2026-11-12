// Talks to the event's ticket server. The server owns stock, prices and tickets: the dot asks it
// for an order, Dash takes the payment, and only the server, once Monime confirms the payment,
// issues tickets. Anything the dot reports can be faked, so it never decides a ticket is paid.
//
// With API_URL empty in .env, a demo server inside the dot answers instead, so the whole flow runs
// in the simulator. Demo tickets say DEMO and aren't valid anywhere.
//
// The server's endpoints (the template's server/ folder implements them):
//   GET  {API_URL}/events/{eventId}                 → LiveEvent
//   POST {API_URL}/events/{eventId}/orders          → HeldOrder      body NewOrder, Idempotency-Key header
//   GET  {API_URL}/orders/{orderId}                 → OrderState     Authorization: Bearer {orderToken}
//   POST {API_URL}/orders/{orderId}/confirm         → OrderState     body PaymentProof, same header
//   PUT  {API_URL}/orders/{orderId}/passes/{passId} → IssuedTicket   body GuestDetails, same header
//   GET  {API_URL}/passes/{passId}?key={claimKey}   → ClaimedPass    for a guest opening a sent pass
//
// A table is one pass that admits its whole party: a Chambers Table of 10 is one QR that lets in
// up to 10 people, one per scan. The buyer can share it with the people at the table, and every
// copy is the same code, so the door counts entries against the 10. Other tickets are one pass per
// guest: a VIP Double is 2 passes, the first named for the buyer, and the buyer names the other and
// sends it. The QR holds a signed pass id, so renaming a pass never changes its code. The door's
// guest list, which the scanner downloads before doors open, carries each pass's name, table and
// how many it admits. (Monime's receipt for the order can back this up: one entitlement a ticket,
// with a limit of how many it admits, redeemed once a scan.)
import type { Dash } from '@monimesl/dot-runtime';

import { guestsOf, isTable, maxPerOrder, type Currency } from './config';
import { salesState, type SalesState } from './sales';
import event from '../event.config';

export const demoMode = !env.API_URL;

export type LiveTicket = {
  id: string;
  /** In minor units. */
  price: number;
  /** null when the server doesn't say. */
  remaining: number | null;
  maxPerOrder: number;
};

export type LiveEvent = {
  sales: SalesState;
  tickets: LiveTicket[];
};

export type NewOrder = {
  items: { ticketId: string; quantity: number }[];
  buyer: { name: string; phone: string; dashId: string };
  /** For a table: the chambers, company or family name on the table card. */
  tableName?: string;
};

export type LineItem = { name: string; unitPrice: { currency: Currency; value: number }; quantity: number };

export type HeldOrder = {
  orderId: string;
  /** Lets this phone read the order back. Keep it; never show it. */
  orderToken: string;
  /** The payment's reference in Monime. */
  reference: string;
  /** The payment sheet's title, such as "Royal Ball tickets". */
  name: string;
  lineItems: LineItem[];
  total: number;
  currency: Currency;
  /** ISO time the seats are held until. */
  holdUntil: string;
};

export type IssuedTicket = {
  /** The pass's id. */
  id: string;
  /** What the QR code holds. The server signs it so the door can check it offline. */
  code: string;
  ticketId: string;
  ticketName: string;
  /** The guest's name, or '' until the buyer names them. */
  holder: string;
  /** The guest's number, '' when not given. */
  holderPhone: string;
  /** Which guest of the ticket this is, such as 2 of 2. A table pass is 1 of 1. */
  guestNumber: number;
  guestCount: number;
  /** How many people this one code lets in: 1, or a table's party, such as 10. */
  admits: number;
  /** The table card's name, '' when not a table. */
  tableName: string;
  /** Lets a phone fetch this pass from a share link: one guest's, or anyone at a table's. '' on a claimed copy. */
  claimKey: string;
};

/** What the buyer sets on a pass. */
export type GuestDetails = { holder: string; holderPhone: string };

/** A pass as a guest's phone gets it from a share link. */
export type ClaimedPass = {
  ticket: IssuedTicket;
  /** Who bought it, such as "Mariama Kamara". */
  from: string;
};

export type OrderState = {
  status: 'held' | 'paid' | 'expired' | 'cancelled';
  tickets: IssuedTicket[];
};

/** What Dash's payment result says to look up in Monime. */
export type PaymentProof = {
  method: 'card' | 'momo' | 'link';
  checkoutSessionId?: string;
  paymentCodeId?: string;
  paymentId?: string;
};

/** A request the server turned down, with words the person can read. */
export class ServerError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function url(path: string): string {
  return `${env.API_URL.replace(/\/$/, '')}${path}`;
}

async function call<T>(dash: Dash, path: string, init: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const response = await dash.network.http.request<unknown>({
    url: url(path),
    method: init.method ?? 'GET',
    headers: init.headers,
    body: init.body as object | undefined,
    as: 'json',
  });
  if (!response.ok) {
    const message = (response.body as { error?: string } | null)?.error;
    throw new ServerError(message || `The ticket server said no (${response.status}).`, response.status);
  }
  return response.body as T;
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

// ── The server's calls ──────────────────────────────────────────────────────────────────────

export async function getLiveEvent(dash: Dash): Promise<LiveEvent> {
  if (demoMode) {
    return demo.liveEvent(dash);
  }
  return call<LiveEvent>(dash, `/events/${encodeURIComponent(event.id)}`);
}

export async function createOrder(dash: Dash, order: NewOrder, idempotencyKey: string): Promise<HeldOrder> {
  if (demoMode) {
    return demo.createOrder(dash, order, idempotencyKey);
  }
  return call<HeldOrder>(dash, `/events/${encodeURIComponent(event.id)}/orders`, {
    method: 'POST',
    body: order,
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}

export async function getOrder(dash: Dash, orderId: string, orderToken: string): Promise<OrderState> {
  if (demoMode) {
    return demo.getOrder(orderId);
  }
  return call<OrderState>(dash, `/orders/${encodeURIComponent(orderId)}`, { headers: bearer(orderToken) });
}

/** Asks the server to check the payment with Monime now, rather than wait for Monime's webhook. */
export async function confirmOrder(dash: Dash, orderId: string, orderToken: string, proof: PaymentProof): Promise<OrderState> {
  if (demoMode) {
    return demo.confirm(orderId);
  }
  return call<OrderState>(dash, `/orders/${encodeURIComponent(orderId)}/confirm`, {
    method: 'POST',
    body: proof,
    headers: bearer(orderToken),
  });
}

/** Names a pass. Only the phone that bought the order can, with its order token. */
export async function nameGuest(dash: Dash, orderId: string, orderToken: string, pass: IssuedTicket, details: GuestDetails): Promise<IssuedTicket> {
  const passId = pass.id;
  if (demoMode) {
    return demo.nameGuest(dash, orderId, pass, details);
  }
  return call<IssuedTicket>(dash, `/orders/${encodeURIComponent(orderId)}/passes/${encodeURIComponent(passId)}`, {
    method: 'PUT',
    body: details,
    headers: bearer(orderToken),
  });
}

/** Fetches a pass a buyer sent, with the key from the share link. */
export async function claimPass(dash: Dash, passId: string, claimKey: string): Promise<ClaimedPass> {
  if (demoMode) {
    return demo.claim(dash, passId, claimKey);
  }
  return call<ClaimedPass>(dash, `/passes/${encodeURIComponent(passId)}?key=${encodeURIComponent(claimKey)}`);
}

// ── The demo server ─────────────────────────────────────────────────────────────────────────
// Lives in memory while the dot runs. It trusts the payment sheet, which a real server never does.

type DemoOrder = HeldOrder & { state: OrderState; buyer: string; items: NewOrder['items']; tableName: string };

const demo = (() => {
  const sold: Record<string, number> = {};
  const orders: Record<string, DemoOrder> = {};
  const byKey: Record<string, string> = {};
  const HOLD_MINUTES = 10;

  function remaining(ticketId: string): number {
    const ticket = event.tickets.find((item) => item.id === ticketId);
    return ticket ? Math.max(0, ticket.quantity - (sold[ticketId] ?? 0)) : 0;
  }

  function expireOld(): void {
    const now = Date.now();
    for (const order of Object.values(orders)) {
      if (order.state.status === 'held' && Date.parse(order.holdUntil) < now) {
        order.state = { status: 'expired', tickets: [] };
        for (const item of order.items) {
          sold[item.ticketId] = (sold[item.ticketId] ?? 0) - item.quantity;
        }
      }
    }
  }

  return {
    async liveEvent(dash: Dash): Promise<LiveEvent> {
      await dash.system.delay(250);
      expireOld();
      return {
        sales: salesState(event.sales, new Date()),
        tickets: event.tickets.map((ticket) => ({
          id: ticket.id,
          price: ticket.price,
          remaining: remaining(ticket.id),
          maxPerOrder: maxPerOrder(ticket),
        })),
      };
    },

    async createOrder(dash: Dash, order: NewOrder, key: string): Promise<HeldOrder> {
      await dash.system.delay(400);
      expireOld();
      const existing = byKey[key] ? orders[byKey[key]] : undefined;
      if (existing) {
        return existing;
      }
      const table = order.items.some((item) => event.tickets.some((t) => t.id === item.ticketId && isTable(t)));
      if (table && !(order.tableName ?? '').trim()) {
        throw new ServerError('Add a name for the table card.', 422);
      }
      for (const item of order.items) {
        if (item.quantity > remaining(item.ticketId)) {
          const name = event.tickets.find((ticket) => ticket.id === item.ticketId)?.name ?? 'That ticket';
          throw new ServerError(`Only ${remaining(item.ticketId)} ${name} tickets are left.`, 409);
        }
      }
      for (const item of order.items) {
        sold[item.ticketId] = (sold[item.ticketId] ?? 0) + item.quantity;
      }
      const orderId = `demo-${(await dash.crypto.randomUUID()).slice(0, 8)}`;
      const lineItems = order.items.map((item) => {
        const ticket = event.tickets.find((t) => t.id === item.ticketId)!;
        return { name: ticket.name, unitPrice: { currency: event.currency, value: ticket.price }, quantity: item.quantity };
      });
      const held: DemoOrder = {
        orderId,
        orderToken: 'demo',
        reference: orderId,
        name: `${event.name} tickets`.slice(0, 64),
        lineItems,
        total: lineItems.reduce((sum, line) => sum + line.unitPrice.value * line.quantity, 0),
        currency: event.currency,
        holdUntil: new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString(),
        state: { status: 'held', tickets: [] },
        buyer: order.buyer.name,
        items: order.items,
        tableName: (order.tableName ?? '').trim(),
      };
      orders[orderId] = held;
      byKey[key] = orderId;
      return held;
    },

    async getOrder(orderId: string): Promise<OrderState> {
      expireOld();
      return orders[orderId]?.state ?? { status: 'expired', tickets: [] };
    },

    async confirm(orderId: string): Promise<OrderState> {
      const order = orders[orderId];
      if (!order) {
        return { status: 'expired', tickets: [] };
      }
      if (order.state.status === 'held') {
        const tickets: IssuedTicket[] = [];
        for (const item of order.items) {
          const ticket = event.tickets.find((t) => t.id === item.ticketId)!;
          const table = isTable(ticket);
          // A table is one pass for its whole party; anything else is a pass a guest.
          const passes = table ? 1 : guestsOf(ticket);
          for (let n = 1; n <= item.quantity; n += 1) {
            for (let guest = 1; guest <= passes; guest += 1) {
              const id = `p-${Math.random().toString(36).slice(2, 10)}`;
              tickets.push({
                id,
                code: `DEMO:${id}`,
                ticketId: ticket.id,
                ticketName: ticket.name,
                // The buyer is the first guest; the rest are named after paying.
                holder: tickets.length === 0 ? order.buyer : '',
                holderPhone: '',
                guestNumber: guest,
                guestCount: passes,
                admits: table ? guestsOf(ticket) : 1,
                tableName: table ? order.tableName : '',
                claimKey: `k-${Math.random().toString(36).slice(2, 14)}`,
              });
            }
          }
        }
        order.state = { status: 'paid', tickets };
      }
      return order.state;
    },

    async nameGuest(dash: Dash, orderId: string, phoneCopy: IssuedTicket, details: GuestDetails): Promise<IssuedTicket> {
      await dash.system.delay(250);
      const order = orders[orderId];
      const known = order?.state.tickets.find((ticket) => ticket.id === phoneCopy.id);
      // The demo forgets its orders whenever the dot restarts, which the simulator does on every
      // save. Passes on the phone outlive it, so it takes the phone's copy rather than refuse.
      // A real server keeps orders in a database and answers 404 for a pass it doesn't know.
      const named = { ...(known ?? phoneCopy), holder: details.holder.trim(), holderPhone: details.holderPhone.trim() };
      if (order && known) {
        order.state = { ...order.state, tickets: order.state.tickets.map((ticket) => (ticket.id === named.id ? named : ticket)) };
      }
      return named;
    },

    async claim(dash: Dash, passId: string, claimKey: string): Promise<ClaimedPass> {
      await dash.system.delay(250);
      for (const order of Object.values(orders)) {
        const pass = order.state.tickets.find((ticket) => ticket.id === passId);
        if (pass && order.state.status === 'paid' && claimKey && pass.claimKey === claimKey) {
          return { ticket: { ...pass, claimKey: '' }, from: order.buyer };
        }
      }
      throw new ServerError('This pass link doesn’t work. Ask the person who sent it to send it again.', 404);
    },
  };
})();
