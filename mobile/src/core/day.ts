// A calendar day with no time or time zone, stored as "yyyy-MM-dd" (the same as Pocket for Mac).
// Money moves on days, so this avoids every midnight / time-zone surprise.
export type Day = string;

export type YearMonth = string; // "yyyy-MM"

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

export function makeDay(year: number, month: number, day: number): Day {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

export function parts(d: Day): [number, number, number] {
  return [Number(d.slice(0, 4)), Number(d.slice(5, 7)), Number(d.slice(8, 10))];
}

export function isDay(s: unknown): s is Day {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = parts(s);
  return y >= 1 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

/** The day `date` falls on in the person's own time zone. */
export function dayOf(date: Date): Day {
  return makeDay(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function today(): Day {
  return dayOf(new Date());
}

/** Noon on this day in the person's time zone: safe for display and date pickers. */
export function localDate(d: Day): Date {
  const [y, m, dd] = parts(d);
  return new Date(y, m - 1, dd, 12);
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function utc(d: Day): number {
  const [y, m, dd] = parts(d);
  return Date.UTC(y, m - 1, dd, 12);
}

export function addDays(d: Day, n: number): Day {
  const t = new Date(utc(d) + n * 86_400_000);
  return makeDay(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Month math clamps to the month's end (Jan 31 + 1 month = Feb 28), like Foundation's Calendar. */
export function addMonths(d: Day, n: number): Day {
  const [y, m, dd] = parts(d);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return makeDay(ny, nm, Math.min(dd, daysInMonth(ny, nm)));
}

export function addYears(d: Day, n: number): Day {
  return addMonths(d, 12 * n);
}

export function daysBetween(a: Day, b: Day): number {
  return Math.round((utc(b) - utc(a)) / 86_400_000);
}

export const yearMonth = (d: Day): YearMonth => d.slice(0, 7);
export const monthContains = (ym: YearMonth, d: Day) => d.startsWith(ym + "-");
export const shiftMonth = (ym: YearMonth, n: number): YearMonth => yearMonth(addMonths(ym + "-01", n));

// ---------- display ----------

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, opts);
const short = fmt({ month: "short", day: "numeric" });
const withWeekday = fmt({ weekday: "short", month: "short", day: "numeric" });
const withYear = fmt({ month: "short", day: "numeric", year: "numeric" });
const monthLong = fmt({ month: "long", year: "numeric" });
const monthName = fmt({ month: "long" });

/** "Oct 13" (adds the year when it isn't this year). */
export function shortDay(d: Day, now: Day = today()): string {
  return (d.slice(0, 4) === now.slice(0, 4) ? short : withYear).format(localDate(d));
}

/** "Thu, Oct 15". */
export function weekdayDay(d: Day): string {
  return withWeekday.format(localDate(d));
}

/** "Today", "Yesterday", "Tomorrow", or "Thu, Oct 15". */
export function relativeDay(d: Day, now: Day = today()): string {
  const diff = daysBetween(now, d);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  return d.slice(0, 4) === now.slice(0, 4) ? weekdayDay(d) : withYear.format(localDate(d));
}

/** "October 2026", or just "October" for this year. */
export function monthTitle(ym: YearMonth, now: Day = today()): string {
  const date = localDate(ym + "-15");
  return ym.slice(0, 4) === now.slice(0, 4) ? monthName.format(date) : monthLong.format(date);
}
