// Dates, times and money as people read them. Copied from Salone Events so both dots match.
import type { Currency } from './config';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const TBA = 'To be announced';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function groupThousands(whole: number): string {
  return String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 15000 → "SLE 150", 15050 → "SLE 150.50", USD 2500 → "$25". */
export function formatMoney(value: number, currency: Currency = 'SLE'): string {
  const whole = Math.floor(value / 100);
  const cents = value % 100;
  const amount = cents === 0 ? groupThousands(whole) : `${groupThousands(whole)}.${String(cents).padStart(2, '0')}`;
  return currency === 'USD' ? `$${amount}` : `${currency} ${amount}`;
}

function parts(date: string): [number, number, number] | null {
  const [year, month, day] = date.split('-').map(Number);
  return year && month && day ? [year, month, day] : null;
}

/** '2026-11-28' → "Sat 28 Nov 2026". */
export function formatDate(date: string): string {
  const p = parts(date);
  if (!p) {
    return date;
  }
  const [year, month, day] = p;
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${DAYS[weekday]} ${day} ${MONTHS[month - 1]} ${year}`;
}

/** '2026-11-28' → "28 Nov". */
export function formatShortDate(date: string): string {
  const p = parts(date);
  return p ? `${p[2]} ${MONTHS[p[1] - 1]}` : date;
}

/** '2026-11-28' → "Sat 28 Nov". */
export function weekdayDate(date: string): string {
  const p = parts(date);
  if (!p) {
    return date;
  }
  const weekday = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
  return `${DAYS[weekday]} ${p[2]} ${MONTHS[p[1] - 1]}`;
}

/** "Sat 28 Nov 2026", or "25 Nov – 30 Nov 2026" over several days. */
export function formatDateRange(date: string, endDate?: string): string {
  if (!endDate || endDate === date) {
    return formatDate(date);
  }
  const end = parts(endDate);
  return end ? `${formatShortDate(date)} – ${formatShortDate(endDate)} ${end[0]}` : formatDate(date);
}

/** '19:30' → "7:30 pm", 'late' → "late". */
export function formatTime(time: string): string {
  if (time === 'late') {
    return 'late';
  }
  const [hours, minutes] = time.split(':').map(Number);
  if (hours === undefined || minutes === undefined || Number.isNaN(hours) || Number.isNaN(minutes)) {
    return time;
  }
  const suffix = hours < 12 ? 'am' : 'pm';
  const hour = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === 0 ? `${hour} ${suffix}` : `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function formatTimeRange(start: string, end: string): string {
  if (!start) {
    return TBA;
  }
  if (!end) {
    return `From ${formatTime(start)}`;
  }
  return end === 'late' ? `${formatTime(start)} till late` : `${formatTime(start)} – ${formatTime(end)}`;
}
