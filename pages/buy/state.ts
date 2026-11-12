import { configRows, groups, salesClosesLabel, type TicketRow } from '../../lib/event-view';
import type { SalesState } from '../../lib/sales';

const rows = configRows();

export default {
  /** Which group shows: the segmented switch at the top. */
  tab: 'individual' as 'individual' | 'tables',
  /** Every ticket type, in config order. The two lists below are this, split for the page. */
  tickets: rows as TicketRow[],
  individual: groups(rows).individual as TicketRow[],
  tables: groups(rows).tables as TicketRow[],
  /** "Online sales close Fri 20 Nov at 3 pm", or ''. */
  salesCloses: salesClosesLabel(),
  /** The server's stock is still loading. */
  loading: true,
  /** Why stock didn't load. */
  liveError: '',
  sales: 'open' as SalesState,
  /** Every ticket type is sold out. */
  soldOut: false,
  /** A ticket type is chosen, so the others are hidden. */
  chosen: false,
  /** Guests chosen, and what they cost. */
  count: 0,
  totalLabel: '',
  /** Paid passes on this phone, to notice a purchase and clear the choice. */
  heldCount: -1,
};
