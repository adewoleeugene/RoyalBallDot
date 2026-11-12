import { eventFacts, salesClosesLabel } from '../../lib/event-view';
import type { SalesState } from '../../lib/sales';

export default {
  event: eventFacts,
  /** "Online sales close Fri 20 Nov at 3 pm", or ''. */
  salesCloses: salesClosesLabel(),
  /** From the sales window in event.config.ts; the buy page asks the server. */
  sales: 'open' as SalesState,
  /** Paid passes on this phone, and what the card at the top says about them. */
  heldCount: 0,
  heldLabel: '',
  heldStatus: '',
  /** Guests still to name or send, so the card's status stands out. */
  heldNeedsAction: false,
  /** The order "Show my pass" opens, or '' for the list. */
  heldOrder: '',
  /** The ball is today: "Show my pass" takes the main button. */
  eventDay: false,
  /** The About sheet. */
  aboutOpen: false,
  toast: '',
};
