// Whether tickets are on sale, from the sales window in event.config.ts. The server decides for
// real; the dot uses this to word the page before the server answers.

export type SalesState = 'open' | 'not-yet' | 'closed';

/** 'YYYY-MM-DD HH:MM' in Freetown time (GMT, no daylight saving) → epoch milliseconds. */
export function freetownTime(text: string): number {
  const [date, time = '00:00'] = text.trim().split(/[ T]/);
  return Date.parse(`${date}T${time}:00Z`);
}

/** Whether `now` falls on the event's day (or days), in Freetown time. */
export function isEventDay(date: string, endDate: string | undefined, now: Date): boolean {
  const today = now.toISOString().slice(0, 10);
  return today >= date && today <= (endDate ?? date);
}

export function salesState(sales: { opens?: string; closes?: string } | undefined, now: Date): SalesState {
  const at = now.getTime();
  if (sales?.opens && at < freetownTime(sales.opens)) {
    return 'not-yet';
  }
  if (sales?.closes && at >= freetownTime(sales.closes)) {
    return 'closed';
  }
  return 'open';
}
