import { errorMessage, isDashError, unlessCancelled } from '@monimesl/dot-runtime';

import { isPhone, normalisePhone } from '../../lib/buyer';
import { eventFacts } from '../../lib/event-view';
import { nameGuest, ServerError } from '../../lib/server';
import { findOrder, updateTicket, type SavedOrder, type StoredTicket } from '../../lib/wallet';
import state, { type TicketSlide } from './state';

/** The last part of a pass id, grouped for reading aloud. */
function shortId(id: string): string {
  const tail = id.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();
  return `${tail.slice(0, 4)} ${tail.slice(4)}`.trim();
}

/** A table's single pass, which admits its whole party. */
function isTablePass(ticket: StoredTicket): boolean {
  return (ticket.admits ?? 1) > 1;
}

function slidesOf(order: SavedOrder): TicketSlide[] {
  return order.tickets.map((ticket, n) => ({
    id: ticket.id,
    code: ticket.code,
    ticketName: ticket.ticketName,
    holder: ticket.holder,
    holderLabel: isTablePass(ticket) ? ticket.tableName || ticket.holder : ticket.holder || `Guest ${n + 1} · not named yet`,
    named: Boolean(ticket.holder) || isTablePass(ticket),
    tableName: isTablePass(ticket) ? '' : (ticket.tableName ?? ''),
    tablePass: isTablePass(ticket),
    position: isTablePass(ticket)
      ? `Admits ${ticket.admits}`
      : ticket.guestCount > 1
        ? `Guest ${ticket.guestNumber} of ${ticket.guestCount}`
        : order.tickets.length > 1
          ? `${n + 1} of ${order.tickets.length}`
          : '',
    shortId: shortId(ticket.id),
    demo: ticket.code.startsWith('DEMO:'),
    sent: Boolean(ticket.sent),
  }));
}

/** The link that opens this pass in Dash on the guest's phone, or '' before the dot has a share link. */
function passLink(ticket: StoredTicket): string {
  const base = (env.SHARE_URL ?? '').replace(/\/$/, '');
  return base && ticket.claimKey ? `${base}/claim?pass=${encodeURIComponent(ticket.id)}&key=${encodeURIComponent(ticket.claimKey)}` : '';
}

export default definePage({
  initialState: state,
  hooks: {
    async onLoad(options) {
      const order = await findOrder(this.dash, options.order ?? '').catch(() => null);
      if (!order || order.status !== 'paid' || order.tickets.length === 0) {
        this.setState({ loading: false, notFound: true });
        return;
      }
      const index = Math.min(Math.max(Number.parseInt(options.index ?? '0', 10) || 0, 0), order.tickets.length - 1);
      this.setState({
        loading: false,
        orderId: order.orderId,
        index,
        slides: slidesOf(order),
        canManage: !order.claimed,
        fromLabel: order.claimed && order.from ? `Sent to you by ${order.from}` : '',
      });
    },
    // Bright and awake while the QR shows, so the door's scanner reads it first time.
    async onShow() {
      await Promise.all([this.dash.system.keepAwake(true).catch(() => undefined), this.dash.system.brightness('max').catch(() => undefined)]);
    },
    async onHide() {
      await Promise.all([this.dash.system.keepAwake(false).catch(() => undefined), this.dash.system.brightness('normal').catch(() => undefined)]);
    },
    // Back to the list: put the screen back too.
    async onUnload() {
      await Promise.all([this.dash.system.keepAwake(false).catch(() => undefined), this.dash.system.brightness('normal').catch(() => undefined)]);
    },
  },
  mutations: {
    setIndex: (_state, event: IndexEvent) => ({ index: event.detail.index }),
    clearToast: () => ({ toast: '' }),
    editGuest: (state, event: DataEvent<{ id: string }>) => {
      const slide = state.slides.find((item) => item.id === event.data.id);
      if (!slide) {
        return {};
      }
      return {
        editing: true,
        editId: slide.id,
        editTitle: slide.position ? `${slide.ticketName} · ${slide.position}` : slide.ticketName,
        editName: slide.holder,
        editPhone: '',
        editNameError: '',
        editPhoneError: '',
        sendAfterSave: false,
        sheetNote: '',
      };
    },
    closeEdit: () => ({ editing: false, sendAfterSave: false, sheetNote: '' }),
    setEditName: (_state, event: ValueEvent) => ({ editName: event.detail.value, editNameError: '' }),
    setEditPhone: (_state, event: ValueEvent) => ({ editPhone: event.detail.value, editPhoneError: '' }),
  },
  actions: {
    /** Saves the guest's name on the server, then on the phone. */
    async saveGuest() {
      const current = this.state;
      if (current.saving) {
        return;
      }
      const name = current.editName.trim();
      const phone = current.editPhone.trim();
      const editNameError = name.length < 2 ? "Enter the guest's full name" : '';
      const editPhoneError = phone && !isPhone(phone) ? 'Enter a Sierra Leone number, such as 76 123456, or leave it empty' : '';
      if (editNameError || editPhoneError) {
        this.setState({ editNameError, editPhoneError });
        return;
      }
      const order = await findOrder(this.dash, current.orderId).catch(() => null);
      const pass = order?.tickets.find((ticket) => ticket.id === current.editId);
      if (!order || !pass) {
        this.setState({ sheetNote: "This pass isn't on this phone any more.", sheetTone: 'danger' });
        return;
      }
      this.setState({ saving: true, sheetNote: '' });
      try {
        const named = await nameGuest(this.dash, order.orderId, order.orderToken, pass, { holder: name, holderPhone: phone ? normalisePhone(phone) : '' });
        const next = await updateTicket(this.dash, order.orderId, { ...named, sent: pass.sent });
        if (next) {
          this.setState({ slides: slidesOf(next) });
        }
      } catch (error) {
        let message = "We couldn't reach the ticket desk. Check your connection and try again.";
        if (error instanceof ServerError) {
          message = error.status === 404 ? "The ticket desk can't find this pass. Call the Ticket Lead and we'll sort it out." : error.message;
        }
        this.setState({ saving: false, sheetNote: message, sheetTone: 'danger' });
        return;
      }
      const sendAfter = this.state.sendAfterSave;
      this.setState({ editing: false, saving: false, sendAfterSave: false, toast: sendAfter ? '' : `Saved ${name}`, toastTone: 'success' });
      if (sendAfter) {
        await this.actions.shareCurrent();
      }
    },

    /** From a slide's Send button. */
    async send(_state, event: DataEvent<{ id: string }>) {
      this.setState({ editId: event.data.id });
      await this.actions.shareCurrent();
    },

    /** Opens the share sheet with the guest's own pass link (the pass in editId). An unnamed pass is named first. */
    async shareCurrent() {
      const passId = this.state.editId;
      const order = await findOrder(this.dash, this.state.orderId).catch(() => null);
      const pass = order?.tickets.find((ticket) => ticket.id === passId);
      if (!order || !pass) {
        return;
      }
      const slide = this.state.slides.find((item) => item.id === passId);
      // A table pass is shared as it is: no name, since one code covers the whole table.
      if (!pass.holder && !isTablePass(pass)) {
        this.setState({
          editing: true,
          editId: pass.id,
          editTitle: slide?.position ? `${pass.ticketName} · ${slide.position}` : pass.ticketName,
          editName: '',
          editPhone: '',
          editNameError: '',
          editPhoneError: '',
          sendAfterSave: true,
          sheetNote: 'Add their name first, so it shows at the door.',
          sheetTone: 'info',
        });
        return;
      }
      const link = passLink(pass);
      const time = eventFacts.timeLabel.charAt(0).toLowerCase() + eventFacts.timeLabel.slice(1);
      const when = `${eventFacts.dateLabel}, ${time}, ${eventFacts.venue}`;
      let text: string;
      if (isTablePass(pass)) {
        const table = pass.tableName ? `the ${pass.tableName} table` : 'our table';
        text = link
          ? `Here's the pass for ${table} at ${eventFacts.title}: ${when}. Open it in Dash and show it at the door. It lets in up to ${pass.admits} of us, one scan each.`
          : `You're at ${table} for ${eventFacts.title}: ${when}.`;
      } else {
        const first = pass.holder.split(' ')[0] ?? pass.holder;
        text = link
          ? `${first}, here's your pass for ${eventFacts.title}: ${when}. Open it in Dash and show it at the door.`
          : `${first}, you're on the guest list for ${eventFacts.title}: ${when}.`;
      }
      try {
        await unlessCancelled(this.dash.system.share({ title: isTablePass(pass) ? `Our table pass for ${eventFacts.title}` : `Your pass for ${eventFacts.title}`, text, url: link || undefined }));
        const next = await updateTicket(this.dash, order.orderId, { ...pass, sent: true });
        if (next) {
          this.setState({ slides: slidesOf(next) });
        }
      } catch (error) {
        if (!isDashError(error, 'cancelled')) {
          this.setState({ toast: errorMessage(error) || "The share sheet didn't open.", toastTone: 'danger' });
        }
      }
    },

    openTickets() {
      this.navigation.replace('tickets');
    },
  },
});
