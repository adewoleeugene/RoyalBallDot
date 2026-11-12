import { errorMessage, isDashError } from '@monimesl/dot-runtime';

import { choiceGuests, choiceSummary, decodeChoice, guestCount, hasTable, priceLabel, ticketGuests, ticketName } from '../../lib/event-view';
import { formatTime } from '../../lib/format';
import { buyerFromDash, isPhone, loadBuyer, normalisePhone, saveBuyer } from '../../lib/buyer';
import { confirmOrder, createOrder, getOrder, ServerError, type HeldOrder, type OrderState, type PaymentProof } from '../../lib/server';
import { findOrder, saveOrder, type SavedOrder } from '../../lib/wallet';
import event from '../../event.config';
import state from './state';

/** How long to keep asking the server for tickets after a completed payment. */
const ISSUE_TRIES = 6;

/** "We're holding your tickets until 9:42 pm." from an ISO time. Freetown keeps GMT all year. */
function holdLabel(iso: string): string {
  const at = new Date(iso);
  const time = `${String(at.getUTCHours()).padStart(2, '0')}:${String(at.getUTCMinutes()).padStart(2, '0')}`;
  return `We're holding your places until ${formatTime(time)}.`;
}

function proofOf(result: { method: string; checkoutSessionId?: string; paymentCodeId?: string; paymentId?: string }): PaymentProof {
  return {
    method: result.method as PaymentProof['method'],
    checkoutSessionId: result.checkoutSessionId,
    paymentCodeId: result.paymentCodeId,
    paymentId: result.paymentId,
  };
}

/** What to say when Dash won't open the payment sheet. */
function paymentError(error: unknown): string {
  if (isDashError(error, 'denied')) {
    return "This event can't take payments right now. Try again later or call the organiser.";
  }
  if (isDashError(error, 'failed') || isDashError(error, 'timeout')) {
    return "We couldn't reach Monime. Check your connection and try again.";
  }
  return errorMessage(error) || "The payment didn't start. Try again.";
}

export default definePage({
  initialState: state,
  hooks: {
    async onLoad(options) {
      const choices = decodeChoice(options.items ?? '');
      if (choices.length === 0) {
        this.setState({ note: 'Choose your tickets first.', noteTone: 'warning' });
        return;
      }
      // Prices shown here come from the config; the server's order has the final word.
      const prices = new Map(event.tickets.map((ticket) => [ticket.id, ticket.price]));
      const total = choices.reduce((sum, choice) => sum + (prices.get(choice.ticketId) ?? 0) * choice.quantity, 0);
      const count = choiceGuests(choices);
      this.setState({
        items: options.items ?? '',
        count,
        countLabel: guestCount(count),
        hasTable: hasTable(choices),
        lines: choices.map((choice) => ({
          id: choice.ticketId,
          label: choice.quantity === 1 ? ticketName(choice.ticketId) : `${choice.quantity} × ${ticketName(choice.ticketId)}`,
          meta: guestCount(choice.quantity * ticketGuests(choice.ticketId)),
          amountLabel: priceLabel((prices.get(choice.ticketId) ?? 0) * choice.quantity),
        })),
        totalLabel: priceLabel(total),
        orderKey: await this.dash.crypto.randomUUID(),
      });
      const buyer = await loadBuyer(this.dash);
      if (buyer) {
        this.setState({ buyerName: buyer.name, buyerPhone: buyer.phone, dashId: buyer.dashId });
      }
    },
    // Back in Dash after approving a mobile money payment.
    async onShow() {
      if (this.state.stage === 'pending' || this.state.stage === 'issuing') {
        await this.actions.checkAgain();
      }
    },
  },
  mutations: {
    editBuyer: () => ({ typing: true }),
    setName: (_state, event: ValueEvent) => ({ buyerName: event.detail.value, nameError: '' }),
    setPhone: (_state, event: ValueEvent) => ({ buyerPhone: event.detail.value, phoneError: '' }),
    setTableName: (_state, event: ValueEvent) => ({ tableName: event.detail.value, tableError: '' }),
  },
  actions: {
    /** Makes sure we know who the tickets are for, or opens the fields with what's missing. */
    async ensureBuyer() {
      const current = this.state;
      if (current.typing) {
        const nameError = current.buyerName.trim().length < 2 ? 'Enter the name for the tickets' : '';
        const phoneError = isPhone(current.buyerPhone) ? '' : 'Enter a Sierra Leone number, such as 76 123456';
        this.setState({ nameError, phoneError });
        return;
      }
      if (current.buyerName) {
        return;
      }
      try {
        const person = await buyerFromDash(this.dash);
        this.setState({ buyerName: person.name, buyerPhone: person.phone, dashId: person.dashId });
      } catch (error) {
        // Refused or not signed in: they type it instead.
        this.setState({
          typing: true,
          note: isDashError(error, 'denied') ? 'Type the name and number for your tickets.' : errorMessage(error),
          noteTone: 'info',
        });
      }
    },

    async pay() {
      if (this.state.stage === 'working') {
        return;
      }
      this.setState({ note: '' });
      if (this.state.hasTable && this.state.tableName.trim().length < 2) {
        this.setState({ tableError: 'Add the name for the table card, such as your chambers or company' });
        return;
      }
      await this.actions.ensureBuyer();
      const ready = this.state;
      if (!ready.buyerName || ready.nameError || ready.phoneError || (ready.typing && !isPhone(ready.buyerPhone))) {
        return;
      }
      this.setState({ stage: 'working' });
      const buyer = { name: ready.buyerName.trim(), phone: normalisePhone(ready.buyerPhone), dashId: ready.dashId };
      await saveBuyer(this.dash, buyer).catch(() => undefined);

      // 1. The server holds the tickets and sets the price.
      let order: HeldOrder;
      try {
        const tableName = ready.hasTable ? ready.tableName.trim() : undefined;
        order = await createOrder(this.dash, { items: decodeChoice(ready.items), buyer, tableName }, ready.orderKey);
      } catch (error) {
        const message = error instanceof ServerError ? error.message : "We couldn't reach the ticket desk. Check your connection and try again.";
        this.setState({ stage: 'review', note: message, noteTone: 'danger' });
        return;
      }
      const saved: SavedOrder = {
        orderId: order.orderId,
        orderToken: order.orderToken,
        reference: order.reference,
        status: 'held',
        summary: choiceSummary(decodeChoice(ready.items)),
        totalLabel: priceLabel(order.total),
        holdUntil: order.holdUntil,
        createdAt: new Date().toISOString(),
        tickets: [],
      };
      await saveOrder(this.dash, saved).catch(() => undefined);
      this.setState({ orderId: order.orderId, totalLabel: priceLabel(order.total), holdLabel: holdLabel(order.holdUntil) });

      // 2. Dash's payment sheet. The money goes to the organiser's Space.
      try {
        const result = await this.dash.payments.request({
          order: {
            name: order.name,
            reference: order.reference,
            lineItems: order.lineItems,
            metadata: { orderId: order.orderId, eventId: event.id },
          },
        });
        if (result.status === 'completed') {
          this.setState({ stage: 'issuing', proof: proofOf(result) });
          await this.actions.issue();
        } else if (result.status === 'pending') {
          this.setState({ stage: 'pending' });
        } else if (result.status === 'expired') {
          this.setState({ note: "The payment timed out before it went through. You haven't been charged." });
          await this.actions.startOver();
        } else {
          this.setState({ stage: 'review' });
        }
      } catch (error) {
        if (isDashError(error, 'cancelled')) {
          this.setState({ stage: 'review' });
          return;
        }
        this.setState({ stage: 'review', note: paymentError(error), noteTone: 'danger' });
      }
    },

    /** After a completed payment: ask the server to confirm it with Monime and send the tickets. */
    async issue() {
      const saved = await findOrder(this.dash, this.state.orderId).catch(() => null);
      if (!saved) {
        return;
      }
      // The proof is used once: later looks just read the order.
      const proof = this.state.proof;
      this.setState({ proof: null });
      for (let attempt = 0; attempt < ISSUE_TRIES; attempt += 1) {
        let result: OrderState | null = null;
        try {
          result = proof && attempt === 0 ? await confirmOrder(this.dash, saved.orderId, saved.orderToken, proof) : await getOrder(this.dash, saved.orderId, saved.orderToken);
        } catch {
          result = null;
        }
        if (result?.status === 'paid') {
          await saveOrder(this.dash, { ...saved, status: 'paid', tickets: result.tickets }).catch(() => undefined);
          // Replace, so Back from the tickets can't return to a paid order.
          this.navigation.replace('ticket', { order: saved.orderId });
          return;
        }
        await this.dash.system.delay(1500 * (attempt + 1));
      }
      this.setState({ stage: 'issuing' });
    },

    /** Pending or issuing: look again, on a tap or when the person comes back. */
    async checkAgain() {
      const { orderId, stage } = this.state;
      if (!orderId || this.state.checking) {
        return;
      }
      this.setState({ checking: true });
      try {
        if (stage === 'pending') {
          const saved = await findOrder(this.dash, orderId).catch(() => null);
          const payment = saved ? await this.dash.payments.get(saved.reference).catch(() => undefined) : undefined;
          if (payment?.status === 'completed') {
            this.setState({ stage: 'issuing', proof: proofOf(payment) });
            await this.actions.issue();
          } else if (payment?.status === 'failed' || payment?.status === 'expired') {
            this.setState({ note: "The payment didn't go through. You haven't been charged." });
            await this.actions.startOver();
          } else if (saved) {
            // The webhook may have beaten Dash to it.
            const order = await getOrder(this.dash, saved.orderId, saved.orderToken).catch(() => null);
            if (order?.status === 'paid') {
              await saveOrder(this.dash, { ...saved, status: 'paid', tickets: order.tickets }).catch(() => undefined);
              this.navigation.replace('ticket', { order: orderId });
            }
          }
        } else if (stage === 'issuing') {
          await this.actions.issue();
        }
      } finally {
        this.setState({ checking: false });
      }
    },

    /** The order is over: a new key and a fresh start, keeping the person's choice, details and note. */
    async startOver() {
      const saved = await findOrder(this.dash, this.state.orderId).catch(() => null);
      if (saved) {
        await saveOrder(this.dash, { ...saved, status: 'expired' }).catch(() => undefined);
      }
      this.setState({
        stage: 'review',
        orderId: '',
        holdLabel: '',
        orderKey: await this.dash.crypto.randomUUID(),
        noteTone: 'warning',
      });
    },
  },
});
