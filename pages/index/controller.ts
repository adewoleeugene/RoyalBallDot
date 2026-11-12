// The event: a short hero, the essentials side by side, About in a sheet, and "Get tickets"
// pinned to the bottom of the screen. Choosing tickets happens on the buy page.
import { errorMessage, isDashError, unlessCancelled } from '@monimesl/dot-runtime';

import { isEventDay, salesState } from '../../lib/sales';
import { loadOrders, passSummary } from '../../lib/wallet';
import event from '../../event.config';
import state from './state';

export default definePage({
  initialState: state,
  hooks: {
    async onLoad() {
      await this.actions.checkDay();
      await this.actions.loadHeld();
    },
    // Back from buying or a pass: new passes may be on the phone, and sales may have closed.
    async onShow() {
      await this.actions.checkDay();
      await this.actions.loadHeld();
    },
    async onRefresh() {
      await this.actions.loadHeld();
    },
  },
  mutations: {
    clearToast: () => ({ toast: '' }),
    openAbout: () => ({ aboutOpen: true }),
    closeAbout: () => ({ aboutOpen: false }),
  },
  actions: {
    checkDay() {
      const now = new Date();
      this.setState({ sales: salesState(event.sales, now), eventDay: isEventDay(event.date, event.endDate, now) });
    },
    async loadHeld() {
      const orders = await loadOrders(this.dash).catch(() => []);
      const summary = passSummary(orders);
      this.setState({
        heldCount: summary.count,
        heldLabel: summary.title,
        heldStatus: summary.status,
        heldNeedsAction: summary.needsAction,
        heldOrder: summary.openOrder,
      });
    },
    /** On the night: straight to the QR when there's one order, else the list. */
    showPass(state) {
      if (state.heldOrder) {
        this.navigation.push('ticket', { order: state.heldOrder });
      } else {
        this.navigation.push('tickets');
      }
    },
    getTickets() {
      this.setState({ aboutOpen: false });
      this.navigation.push('buy');
    },
    openTickets() {
      this.navigation.push('tickets');
    },
    async share(state) {
      const text = `${state.event.title}: ${state.event.dateLabel} at ${state.event.venue}. Get tickets on Dash.`;
      const url = env.SHARE_URL || undefined;
      try {
        await unlessCancelled(this.dash.system.share({ title: state.event.title, text, url }));
      } catch (error) {
        this.setState({ toast: errorMessage(error) });
      }
    },
    async call() {
      if (!event.phone) {
        return;
      }
      try {
        await unlessCancelled(this.dash.system.dial(event.phone));
      } catch (error) {
        if (!isDashError(error, 'cancelled')) {
          this.setState({ toast: errorMessage(error) });
        }
      }
    },
  },
});
