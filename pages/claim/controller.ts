// Opened from a pass a buyer sent: https://dashit.to/d/<code>/claim?pass=<id>&key=<claimKey>.
// Fetches the guest's pass from the ticket server, keeps it on this phone, and shows it.
import { claimPass, ServerError } from '../../lib/server';
import { findOrder, saveOrder } from '../../lib/wallet';
import state from './state';

/** The pass's place in this phone's wallet. */
export function claimedOrderId(passId: string): string {
  return `pass-${passId}`;
}

export default definePage({
  initialState: state,
  share: { options: ['pass', 'key'] },
  hooks: {
    async onLoad(options) {
      this.setState({ pass: (options.pass ?? '').trim(), key: (options.key ?? '').trim() });
      await this.actions.open();
    },
  },
  actions: {
    async open() {
      const { pass, key } = this.state;
      if (!pass || !key) {
        this.setState({ loading: false, error: 'This pass link is missing a part. Ask the person who sent it to send it again.' });
        return;
      }
      const orderId = claimedOrderId(pass);
      // Already on this phone: show it, even without signal.
      const existing = await findOrder(this.dash, orderId).catch(() => null);
      if (existing) {
        this.navigation.replace('ticket', { order: orderId });
        return;
      }
      try {
        const claimed = await claimPass(this.dash, pass, key);
        await saveOrder(this.dash, {
          orderId,
          orderToken: '',
          reference: '',
          status: 'paid',
          summary: claimed.ticket.ticketName,
          totalLabel: '',
          holdUntil: '',
          createdAt: new Date().toISOString(),
          tickets: [claimed.ticket],
          claimed: true,
          from: claimed.from,
        });
        this.navigation.replace('ticket', { order: orderId });
      } catch (error) {
        const message = error instanceof ServerError ? error.message : "We couldn't reach the ticket desk. Check your connection and open the link again.";
        this.setState({ loading: false, error: message });
      }
    },
    backToEvent() {
      this.navigation.reset('index');
    },
  },
});
