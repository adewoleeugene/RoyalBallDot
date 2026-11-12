// Who the tickets are for: from Dash sign-in when the person allows it, else typed by hand.
// Kept on the phone so the next order is one tap.
import type { Dash } from '@monimesl/dot-runtime';

export type Buyer = { name: string; phone: string; dashId: string };

const KEY = 'buyer';

export async function loadBuyer(dash: Dash): Promise<Buyer | null> {
  const saved = await dash.storage.cache.get<Buyer>(KEY).catch(() => null);
  return saved && saved.name ? saved : null;
}

export async function saveBuyer(dash: Dash, buyer: Buyer): Promise<void> {
  await dash.storage.cache.set(KEY, buyer);
}

/** Asks Dash for the person's name and number. Rejects with `denied` if they say no. */
export async function buyerFromDash(dash: Dash): Promise<Buyer> {
  const person = await dash.account.signIn({ mode: 'simple' });
  return { name: person.fullName, phone: person.alias, dashId: person.accountIdToken };
}

/** '076 123456', '+232 76 123 456', '76123456' → '+23276123456'. Other text comes back as typed. */
export function normalisePhone(text: string): string {
  const digits = text.replace(/[^\d]/g, '');
  if (digits.length === 8) return `+232${digits}`;
  if (digits.length === 9 && digits.startsWith('0')) return `+232${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith('232')) return `+${digits}`;
  return text.trim();
}

export function isPhone(text: string): boolean {
  return /^\+232\d{8}$/.test(normalisePhone(text));
}
