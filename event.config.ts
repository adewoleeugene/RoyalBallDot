// ─────────────────────────────────────────────────────────────────────────────────────────────
//  The Lawyers' Society Royal Ball Dinner. This is the only file you need to change.
//
//  Prices are in cents (minor units): Le 1,500 is 150000. Dates are 'YYYY-MM-DD', times 'HH:MM'
//  (24-hour, Freetown time). The hero picture lives in statics/ as a JPEG under 1 MB.
//
//  Ticket stock and prices are checked again by the ticket server, so changing a price here
//  alone doesn't change what people pay. See README.md.
// ─────────────────────────────────────────────────────────────────────────────────────────────
import { defineEvent } from './lib/config';

export default defineEvent({
  // A short id for this event. The ticket server knows it by this.
  id: 'lawyers-society-royal-ball-2026',

  name: 'The Lawyers’ Society Royal Ball',
  shortName: 'Royal Ball',
  // One line under the name.
  summary: 'An unforgettable evening of elegance, glamour and royalty.',
  // Markdown. Shown under "About".
  description: [
    'The countdown is on. Join colleagues from across the profession for **The Lawyers’ Society Royal Ball Dinner**, an evening of elegance, glamour and royalty.',
    '',
    '**Red carpet** from 6 pm. The **main event** starts at 7 pm.',
    '',
    'Buying a **table**? You get one table pass that lets in your whole party, one scan each. Share it with the people at your table in Dash.',
    '',
    'Buying a **VIP Double**? You get two passes: one for you, and one to name and send to your guest.',
    '',
    'Prefer to pay cash? Call the Ticket Lead, Ms. Ayesha Munu, on +232 76 828 164.',
    '',
    '*Lex Super Omnia.*',
  ].join('\n'),
  poster: 'statics/hero.jpg',

  date: '2026-11-20',
  startTime: '18:00',

  venue: 'Melian Event Center',
  city: 'Freetown',

  organiser: 'The Lawyers’ Society',
  phone: '+23276828164',
  dressCode: 'Royal formal',

  currency: 'SLE',
  // Stock is a placeholder. Set the real numbers of seats and tables before selling.
  // Each tab climbs in gold with the price: tier 1 charcoal, 2 a gold tint, 3 rich gold.
  tickets: [
    {
      id: 'ordinary',
      tier: 1,
      name: 'Ordinary',
      price: 150000,
      quantity: 300,
      maxPerOrder: 10,
    },
    {
      id: 'vip-single',
      tier: 2,
      name: 'VIP Single',
      description: 'VIP seating',
      price: 300000,
      quantity: 100,
      maxPerOrder: 10,
    },
    {
      id: 'vip-double',
      tier: 3,
      name: 'VIP Double',
      description: 'VIP seating',
      price: 500000,
      quantity: 50,
      maxPerOrder: 5,
      guests: 2,
    },
    {
      id: 'family-table-5',
      tier: 1,
      name: 'Family Table of 5',
      kind: 'table',
      guests: 5,
      price: 1500000,
      quantity: 20,
    },
    {
      id: 'chambers-table-10',
      tier: 2,
      name: 'Chambers Table of 10',
      kind: 'table',
      guests: 10,
      price: 2500000,
      quantity: 20,
    },
    {
      id: 'corporate-table-10',
      tier: 3,
      name: 'Corporate Table of 10',
      kind: 'table',
      guests: 10,
      price: 5000000,
      quantity: 20,
    },
  ],

  // When tickets can be bought. The flyer said sales close on 10 November; this keeps the dot
  // selling until the afternoon of the ball. Change it if the committee wants a different cut-off.
  sales: {
    closes: '2026-11-20 15:00',
  },

  // Shown on the checkout page. Keep it short and true.
  refundPolicy: 'Tickets can’t be refunded unless the Royal Ball is cancelled.',

  // Black and gold, from the poster.
  theme: {
    background: '#0B0906',
    text: '#F6EFD9',
    accent: '#D4A84B',
  },
});
