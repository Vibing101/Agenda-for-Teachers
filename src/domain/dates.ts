/**
 * Plain date arithmetic on `YYYY-MM-DD` strings.
 *
 * Everything here works in UTC on purpose. The app deals in calendar days, not
 * instants: a lesson on the 14th is on the 14th regardless of which side of a
 * daylight-saving change the teacher's laptop is on, and local-time arithmetic
 * is the classic way to end up a day out.
 */

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  // Rejects 2026-02-31 and friends: the round-trip only survives a real date.
  return toIso(parseIso(value)) === value;
}

/** Milliseconds since the epoch, at midnight UTC on that calendar day. */
export function parseIso(value: string): number {
  const [y, m, d] = value.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function toIso(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

const DAY = 24 * 60 * 60 * 1000;

export function addDays(value: string, days: number): string {
  return toIso(parseIso(value) + days * DAY);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseIso(to) - parseIso(from)) / DAY);
}

/** 1 = Monday … 7 = Sunday. */
export function weekdayOf(value: string): number {
  const day = new Date(parseIso(value)).getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * The Monday of the week `value` falls in.
 *
 * The source product does the same thing — "Η ατζέντα γυρίζει πάντα στη Δευτέρα
 * εκείνης της εβδομάδας" — so a teacher who types the Wednesday she went back
 * to school gets the week she meant rather than a year offset by two days.
 */
export function mondayOf(value: string): string {
  return addDays(value, -(weekdayOf(value) - 1));
}

export function monthOf(value: string): number {
  return Number(value.slice(5, 7));
}

export function dayOfMonth(value: string): number {
  return Number(value.slice(8, 10));
}

/**
 * `14.09.2026` — the format the source product asks the teacher for, so the
 * dates she reads back look like the ones she is used to typing.
 */
export function formatDate(value: string): string {
  if (!isIsoDate(value)) return value;
  return `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}`;
}
