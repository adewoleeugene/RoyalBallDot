import type { PaymentProof } from '../../lib/server';
import event from '../../event.config';

export type Line = { id: string; label: string; meta: string; amountLabel: string };

export default {
  /** 'ordinary:2,vip-double:1' from the event page. */
  items: '',
  lines: [] as Line[],
  /** Guests the order lets in. */
  count: 0,
  countLabel: '',
  totalLabel: '',
  /** The order has a table, so it needs a name for the table card. */
  hasTable: false,
  tableName: '',
  tableError: '',
  /** Who the tickets are for. */
  buyerName: '',
  buyerPhone: '',
  /** From Dash sign-in, '' when typed by hand. Recognises the person; proves nothing. */
  dashId: '',
  /** Show the name and number fields. */
  typing: false,
  nameError: '',
  phoneError: '',
  /** One key per order, so a double tap or a retry never makes two orders. */
  orderKey: '',
  /** The held order, once the server made it. */
  orderId: '',
  holdLabel: '',
  /**
   * review: choosing. working: making the order or in Dash's sheet. pending: paid with mobile
   * money that hasn't gone through yet. issuing: paid, waiting for the server to send tickets.
   */
  stage: 'review' as 'review' | 'working' | 'pending' | 'issuing',
  note: '',
  noteTone: 'danger' as 'danger' | 'warning' | 'info',
  /** What Dash's sheet said to look up in Monime, for the server's first check. */
  proof: null as PaymentProof | null,
  refundPolicy: event.refundPolicy ?? '',
  checking: false,
};
