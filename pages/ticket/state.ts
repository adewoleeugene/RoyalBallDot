import { eventFacts } from '../../lib/event-view';

export type TicketSlide = {
  id: string;
  code: string;
  ticketName: string;
  /** The guest's name, or '' until named. */
  holder: string;
  /** What the pass says under the QR: the name, or "Guest 3 · not named yet". */
  holderLabel: string;
  named: boolean;
  /** The table card's name, '' when not a table. */
  tableName: string;
  /** "Guest 2 of 2", "1 of 3" for separate tickets, or "Admits 10" for a table pass. */
  position: string;
  /** One code for a whole table: shared with the table, never named. */
  tablePass: boolean;
  /** The pass's short id, for the door to type in if the QR won't scan. */
  shortId: string;
  demo: boolean;
  /** This phone sent the pass to the guest. */
  sent: boolean;
};

export default {
  loading: true,
  notFound: false,
  orderId: '',
  slides: [] as TicketSlide[],
  index: 0,
  /** The buyer's phone can name and send passes; a guest's phone only shows theirs. */
  canManage: false,
  /** On a guest's phone: who sent the pass. */
  fromLabel: '',
  title: eventFacts.title,
  when: `${eventFacts.dateLabel} · ${eventFacts.timeLabel}`,
  venue: eventFacts.venue,

  /** The guest sheet. */
  editing: false,
  editId: '',
  editTitle: '',
  editName: '',
  editPhone: '',
  editNameError: '',
  editPhoneError: '',
  /** Send the pass once it's named, when the person tapped Send on an unnamed pass. */
  sendAfterSave: false,
  saving: false,
  sheetNote: '',
  /** info for a hint, danger when saving failed. */
  sheetTone: 'info' as 'info' | 'danger',

  toast: '',
  toastTone: 'success' as 'success' | 'danger',
};
