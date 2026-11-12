// The dot's pages and look. Colours come from event.config.ts: Dash works out the card, field and
// border colours from the background, and the accent goes only on the page's main button.
import { tierColors } from './lib/config';
import event from './event.config';

const { background, text, accent } = event.theme;

export default defineDot({
  // index: the event, with Get tickets. buy: choosing tickets and tables. checkout: who and pay. tickets: what you hold. ticket: the
  // QR passes, where the buyer names and sends each guest theirs. claim: a guest opening a sent pass.
  pages: ['index', 'buy', 'checkout', 'tickets', 'ticket', 'claim'],
  theme: {
    scheme: 'dark',
    shape: 'soft',
    colors: {
      primary: { light: accent, dark: accent },
      background: { light: background, dark: background },
      text: { light: text, dark: text },
      // The ticket cards' black-and-gold ladder: tier1Card, tier1Text, tier1Muted and so on.
      // The page is always dark, so light and dark match.
      custom: Object.fromEntries(
        Object.entries(tierColors(event.theme)).flatMap(([tier, colors]) =>
          Object.entries(colors).map(([part, hex]) => [`tier${tier}${part.charAt(0).toUpperCase()}${part.slice(1)}`, { light: hex, dark: hex }]),
        ),
      ),
    },
  },
  configs: {
    navigationBar: { title: event.shortName, backgroundColor: background, textColor: text },
  },
  hooks: {
    onError(error) {
      console.error(error);
    },
  },
});
