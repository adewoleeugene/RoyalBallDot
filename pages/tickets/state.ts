import { eventFacts } from '../../lib/event-view';

export type OrderRow = {
  orderId: string;
  /** The table card's name for a table, else what was bought, such as "2 Ordinary". */
  title: string;
  /** "Chambers Table of 10 · SLE 25,000". */
  subtitle: string;
  summary: string;
  totalLabel: string;
  status: 'held' | 'paid' | 'expired' | 'cancelled';
  /** Guests other than the buyer. */
  guestCount: number;
  /** 0 to 100: half for naming every guest, half for sending every pass. */
  progress: number;
  progressLabel: string;
  tickets: { id: string; title: string; subtitle: string; badge: string; index: number }[];
};

export default {
  loading: true,
  orders: [] as OrderRow[],
  /** Orders still waiting on a payment. */
  waiting: [] as OrderRow[],
  error: '',
  eventWhen: `${eventFacts.dateLabel} · ${eventFacts.venue}`,
};
