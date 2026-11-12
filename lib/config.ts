// The shape of event.config.ts, and helpers that read it.

export type Hex = `#${string}`;

export type Currency = 'SLE' | 'USD';

export type TicketTypeConfig = {
  /** Letters, digits and hyphens, unique in this event. */
  id: string;
  name: string;
  description?: string;
  /** In minor units: SLE 150 is 15000. */
  price: number;
  /** How many there are in all. */
  quantity: number;
  /** The most one order can have. Default 10. A table is always 1 per order. */
  maxPerOrder?: number;
  /** How many people one of these lets in, each with their own named pass. Default 1. */
  guests?: number;
  /** 'table' rows sit under Tables, are chosen with one tap, and ask for a name for the table card. */
  kind?: 'individual' | 'table';
  /**
   * How much gold its card gets on the buy page: 1 a quiet charcoal card, 2 a dark gold tint,
   * 3 a rich gold, for the top of each tab. Default 1.
   */
  tier?: 1 | 2 | 3;
};

export type EventConfig = {
  id: string;
  name: string;
  /** A few words for Dash's title bar, which cuts off long names. */
  shortName: string;
  summary: string;
  description: string;
  poster: string;
  date: string;
  endDate?: string;
  startTime: string;
  endTime?: string;
  venue: string;
  address?: string;
  city?: string;
  organiser: string;
  phone?: string;
  website?: string;
  ageLimit?: string;
  dressCode?: string;
  currency: Currency;
  tickets: TicketTypeConfig[];
  sales?: { opens?: string; closes?: string };
  refundPolicy?: string;
  /** Colours as #RRGGBB. */
  theme: { background: Hex; text: Hex; accent: Hex };
};

/** Gives event.config.ts its types and checks the parts a typo would break. */
export function defineEvent(config: EventConfig): EventConfig {
  const ids = new Set<string>();
  for (const ticket of config.tickets) {
    if (!/^[a-z0-9-]+$/.test(ticket.id)) {
      throw new Error(`Ticket id "${ticket.id}" can only have lowercase letters, digits and hyphens.`);
    }
    if (ids.has(ticket.id)) {
      throw new Error(`Two tickets have the id "${ticket.id}".`);
    }
    ids.add(ticket.id);
    if (ticket.guests !== undefined && (!Number.isInteger(ticket.guests) || ticket.guests < 1)) {
      throw new Error(`Ticket "${ticket.id}" needs a whole number of guests, 1 or more.`);
    }
    if (!Number.isInteger(ticket.price) || ticket.price < 0) {
      throw new Error(`Ticket "${ticket.id}" needs a price in cents, such as 15000 for 150.`);
    }
  }
  if (config.tickets.length === 0 || config.tickets.length > 16) {
    throw new Error('An event needs between 1 and 16 ticket types.');
  }
  return config;
}

export const DEFAULT_MAX_PER_ORDER = 10;

export type Tier = 1 | 2 | 3;

/** A card's three colours: its background, its name and price, and its smaller text. */
export type TierColors = { card: Hex; text: Hex; muted: Hex };

/** Mixes `color` into `base`: amount 0 is `base`, 1 is `color`. */
export function mix(color: Hex, base: Hex, amount: number): Hex {
  const channel = (hex: string, at: number) => Number.parseInt(hex.slice(at, at + 2), 16);
  const blend = (at: number) => Math.round(channel(base, at) + (channel(color, at) - channel(base, at)) * amount);
  return `#${[1, 3, 5].map((at) => blend(at).toString(16).padStart(2, '0')).join('')}` as Hex;
}

/** The three steps of the black-and-gold ladder, from the event's own theme colours. */
export function tierColors(theme: { background: Hex; text: Hex; accent: Hex }): Record<Tier, TierColors> {
  const { background, text, accent } = theme;
  return {
    1: { card: mix(text, background, 0.07), text, muted: mix(text, background, 0.55) },
    2: { card: mix(accent, background, 0.2), text: accent, muted: mix(accent, background, 0.65) },
    // A rich gold, not solid gold: Dash's stepper draws its number in the page's text colour,
    // which wouldn't read on solid gold.
    3: { card: mix(accent, background, 0.42), text: mix('#FFF4D6', accent, 0.55), muted: mix(text, accent, 0.6) },
  };
}

export function tierOf(ticket: Pick<TicketTypeConfig, 'tier'>): Tier {
  return ticket.tier ?? 1;
}

export function guestsOf(ticket: Pick<TicketTypeConfig, 'guests'>): number {
  return ticket.guests ?? 1;
}

export function isTable(ticket: Pick<TicketTypeConfig, 'kind'>): boolean {
  return ticket.kind === 'table';
}

/** The most one order can have of a ticket type. */
export function maxPerOrder(ticket: Pick<TicketTypeConfig, 'kind' | 'maxPerOrder'>): number {
  return isTable(ticket) ? 1 : (ticket.maxPerOrder ?? DEFAULT_MAX_PER_ORDER);
}
