// The event from event.config.ts, worded for the page. Plain data, so state.ts can start from it.
import { guestsOf, isTable, maxPerOrder, tierOf } from './config';
import { formatDateRange, formatMoney, formatTime, formatTimeRange, weekdayDate } from './format';
import type { LiveEvent } from './server';
import event from '../event.config';

export type TicketRow = {
  id: string;
  name: string;
  /** The line under the name: the config's description, and for groups the price a guest. */
  detail: string;
  kind: 'individual' | 'table';
  /** Its card's colours in the theme, from its tier: the card, its name and price, its small text. */
  card: string;
  tone: string;
  muted: string;
  /** People one of these lets in. */
  guests: number;
  price: number;
  priceLabel: string;
  /** The most the Stepper allows: the order limit, or what's left if fewer. Tables: 1. */
  max: number;
  quantity: number;
  soldOut: boolean;
  /** "3 left" when few remain, else ''. */
  leftLabel: string;
};

/** At or below this many left, the row says how many. */
export const FEW_LEFT = 5;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Splits a title into two lines at the word break that keeps them most even: "Melian Event Center" → ["Melian", "Event Center"]. */
export function twoLines(text: string): [string, string] {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) {
    return [text.trim(), ''];
  }
  let best: [string, string] = [words[0]!, words.slice(1).join(' ')];
  for (let cut = 1; cut < words.length; cut += 1) {
    const pair: [string, string] = [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
    if (Math.max(pair[0].length, pair[1].length) < Math.max(best[0].length, best[1].length)) {
      best = pair;
    }
  }
  return best;
}

/** '2026-11-20' → ["Friday", "20 Nov"]. */
function dateLines(date: string): [string, string] {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) {
    return [date, ''];
  }
  const short = weekdayDate(date).split(' ').slice(1).join(' ');
  return [WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]!, short];
}

export type Fact = { id: string; icon: 'calendar' | 'location' | 'dress'; top: string; bottom: string; caption: string };

/** The event page's three essentials, each with a two-line title. */
function factsOf(): Fact[] {
  const [dateTop, dateBottom] = dateLines(event.date);
  const [venueTop, venueBottom] = twoLines(event.venue);
  const facts: Fact[] = [
    { id: 'when', icon: 'calendar', top: dateTop, bottom: dateBottom, caption: formatTimeRange(event.startTime, event.endTime ?? '') },
    { id: 'where', icon: 'location', top: venueTop, bottom: venueBottom, caption: event.city ?? event.address ?? '' },
  ];
  if (event.dressCode) {
    const [dressTop, dressBottom] = twoLines(event.dressCode);
    facts.push({ id: 'dress', icon: 'dress', top: dressTop, bottom: dressBottom, caption: 'Dress code' });
  }
  return facts;
}

export const eventFacts = {
  title: event.name,
  summary: event.summary,
  description: event.description,
  poster: event.poster,
  // The organiser, unless the event's name already says it.
  kicker: [event.name.includes(event.organiser) ? '' : event.organiser, event.ageLimit ?? ''].filter(Boolean).join(' · '),
  dateLabel: formatDateRange(event.date, event.endDate),
  facts: factsOf(),
  /** "Fri 20 Nov", for tight spaces. */
  shortDate: weekdayDate(event.date),
  timeLabel: formatTimeRange(event.startTime, event.endTime ?? ''),
  venue: event.venue,
  address: [event.address, event.city].filter(Boolean).join(', '),
  dressCode: event.dressCode ?? '',
  phone: event.phone ?? '',
  website: event.website ?? '',
};

export function priceLabel(price: number): string {
  return price === 0 ? 'Free' : formatMoney(price, event.currency);
}

/** "1 guest", "10 guests". */
export function guestCount(count: number): string {
  return count === 1 ? '1 guest' : `${count} guests`;
}

/** "10 guests · SLE 2,500 a guest" for groups, '' for one person. */
function groupDetail(guests: number, price: number): string {
  if (guests <= 1) {
    return '';
  }
  const each = Math.round(price / guests);
  return `${guestCount(guests)} · ${priceLabel(each)} a guest`;
}

function detailOf(description: string, guests: number, price: number): string {
  return [description, groupDetail(guests, price)].filter(Boolean).join(' · ');
}

/** "Online sales close Fri 20 Nov at 3 pm", or '' when there's no closing time. */
export function salesClosesLabel(): string {
  const closes = event.sales?.closes;
  if (!closes) {
    return '';
  }
  const [date = '', time = ''] = closes.trim().split(/[ T]/);
  return time ? `Online sales close ${weekdayDate(date)} at ${formatTime(time)}` : `Online sales close ${weekdayDate(date)}`;
}

/** The ticket rows before the server answers: everything from the config, nothing chosen. */
export function configRows(): TicketRow[] {
  return event.tickets.map((ticket) => ({
    id: ticket.id,
    name: ticket.name,
    detail: detailOf(ticket.description ?? '', guestsOf(ticket), ticket.price),
    kind: isTable(ticket) ? 'table' : 'individual',
    card: `tier${tierOf(ticket)}Card`,
    tone: `tier${tierOf(ticket)}Text`,
    muted: `tier${tierOf(ticket)}Muted`,
    guests: guestsOf(ticket),
    price: ticket.price,
    priceLabel: priceLabel(ticket.price),
    max: maxPerOrder(ticket),
    quantity: 0,
    soldOut: false,
    leftLabel: '',
  }));
}

/** Folds the server's prices and stock into the rows, keeping what the person already chose. */
export function mergeLive(rows: readonly TicketRow[], live: LiveEvent): TicketRow[] {
  return rows.map((row) => {
    const ticket = live.tickets.find((item) => item.id === row.id);
    if (!ticket) {
      return { ...row, soldOut: true, quantity: 0, max: 0, leftLabel: '' };
    }
    const left = ticket.remaining;
    const limit = row.kind === 'table' ? 1 : ticket.maxPerOrder;
    const max = left === null ? limit : Math.min(limit, left);
    const description = event.tickets.find((item) => item.id === row.id)?.description ?? '';
    return {
      ...row,
      price: ticket.price,
      priceLabel: priceLabel(ticket.price),
      detail: detailOf(description, row.guests, ticket.price),
      max,
      quantity: Math.min(row.quantity, max),
      soldOut: left === 0,
      leftLabel: left !== null && left > 0 && left <= FEW_LEFT ? `${left} left` : '',
    };
  });
}

/**
 * The rows under each tab. One ticket type per order: once one is chosen, its tab shows only it,
 * and the other tab still shows everything, where choosing replaces it.
 */
export function groups(rows: readonly TicketRow[]): { individual: TicketRow[]; tables: TicketRow[] } {
  const chosen = rows.find((row) => row.quantity > 0);
  const individual = rows.filter((row) => row.kind === 'individual');
  const tables = rows.filter((row) => row.kind === 'table');
  return {
    individual: chosen?.kind === 'individual' ? [chosen] : individual,
    tables: chosen?.kind === 'table' ? [chosen] : tables,
  };
}

/** Sets one ticket type's quantity and clears every other: one ticket type per order. */
export function chooseOnly(rows: readonly TicketRow[], id: string, quantity: number): TicketRow[] {
  return rows.map((row) => (row.id === id ? { ...row, quantity: Math.max(0, Math.min(quantity, row.max)) } : { ...row, quantity: 0 }));
}

/** A table is chosen with one tap and un-chosen with another. Choosing it clears anything else. */
export function toggleTable(rows: readonly TicketRow[], id: string): TicketRow[] {
  const row = rows.find((item) => item.id === id);
  if (!row || row.kind !== 'table') {
    return [...rows];
  }
  return chooseOnly(rows, id, row.quantity > 0 || row.soldOut || row.max < 1 ? 0 : 1);
}

export type Choice = { ticketId: string; quantity: number };

/** 'ordinary:2,vip-double:1', for the checkout page's launch options. */
export function encodeChoice(rows: readonly TicketRow[]): string {
  return rows
    .filter((row) => row.quantity > 0)
    .map((row) => `${row.id}:${row.quantity}`)
    .join(',');
}

export function decodeChoice(text: string): Choice[] {
  return text
    .split(',')
    .map((part) => part.split(':'))
    .map(([ticketId = '', count = '']) => ({ ticketId, quantity: Number.parseInt(count, 10) }))
    .filter((choice) => event.tickets.some((ticket) => ticket.id === choice.ticketId) && choice.quantity > 0);
}

export function ticketName(ticketId: string): string {
  return event.tickets.find((ticket) => ticket.id === ticketId)?.name ?? 'Ticket';
}

export function ticketGuests(ticketId: string): number {
  const ticket = event.tickets.find((item) => item.id === ticketId);
  return ticket ? guestsOf(ticket) : 1;
}

export function hasTable(choices: readonly Choice[]): boolean {
  return choices.some((choice) => event.tickets.some((ticket) => ticket.id === choice.ticketId && isTable(ticket)));
}

/** Everyone the choice lets in. */
export function choiceGuests(choices: readonly Choice[]): number {
  return choices.reduce((sum, choice) => sum + choice.quantity * ticketGuests(choice.ticketId), 0);
}

/** "2 Ordinary, 1 VIP Double". */
export function choiceSummary(choices: readonly Choice[]): string {
  return choices.map((choice) => `${choice.quantity} ${ticketName(choice.ticketId)}`).join(', ');
}
