/**
 * Calendar dates, anchored to Asia/Kolkata.
 *
 * Business dates here (receipt date, due date, expense payment date) are
 * calendar dates, not instants. They are stored as SQL `DATE` and represented
 * in JS as a `Date` pinned to UTC midnight, so every read/write/comparison
 * uses UTC accessors and no timezone can shift a payment across a month
 * boundary. The only place the IST offset matters is deciding what "today" is,
 * which `todayInIST` handles.
 */

export const IST_TIMEZONE = "Asia/Kolkata";

const IST_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: IST_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The current calendar date in India, as a UTC-midnight Date. */
export function todayInIST(now: Date = new Date()): Date {
  const [year, month, day] = IST_PARTS.format(now).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Strip any time component, keeping the UTC calendar day. */
export function dateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

/** "2026-09-15" -> UTC-midnight Date. Returns null for anything malformed. */
export function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejects 31 Feb and friends, which JS would otherwise roll forward.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

/** UTC-midnight Date -> "2026-09-15", the value an <input type="date"> wants. */
export function toDateInputValue(value: Date | null | undefined): string {
  if (!value) return "";
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, "0"),
    String(value.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function compareDates(a: Date, b: Date): number {
  return a.getTime() - b.getTime();
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((dateOnly(to).getTime() - dateOnly(from).getTime()) / 86_400_000);
}

/* -------------------------------------------------------------------------- */
/* Months                                                                      */
/* -------------------------------------------------------------------------- */

/** `month` is 1-12, matching how a human writes it. */
export type MonthKey = { year: number; month: number };

export function monthKeyOf(value: Date): MonthKey {
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1 };
}

export function currentMonthKey(now: Date = new Date()): MonthKey {
  return monthKeyOf(todayInIST(now));
}

/** "2026-09" -> { year: 2026, month: 9 }. Returns null when unparseable. */
export function parseMonthKey(value: string | null | undefined): MonthKey | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return { year, month };
}

export function formatMonthKey(key: MonthKey): string {
  return `${key.year}-${String(key.month).padStart(2, "0")}`;
}

export function monthKeysEqual(a: MonthKey, b: MonthKey): boolean {
  return a.year === b.year && a.month === b.month;
}

export function compareMonthKeys(a: MonthKey, b: MonthKey): number {
  return a.year - b.year || a.month - b.month;
}

/** First day of the month, inclusive. */
export function monthStart(key: MonthKey): Date {
  return new Date(Date.UTC(key.year, key.month - 1, 1));
}

/** First day of the following month — use as an exclusive upper bound. */
export function monthEndExclusive(key: MonthKey): Date {
  return new Date(Date.UTC(key.year, key.month, 1));
}

/** Last day of the month, inclusive. */
export function monthEndInclusive(key: MonthKey): Date {
  return new Date(Date.UTC(key.year, key.month, 0));
}

export function addMonths(key: MonthKey, delta: number): MonthKey {
  const zeroBased = key.year * 12 + (key.month - 1) + delta;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

export function isInMonth(value: Date, key: MonthKey): boolean {
  return value.getUTCFullYear() === key.year && value.getUTCMonth() + 1 === key.month;
}

/** `count` months ending at (and including) `key`, oldest first. */
export function trailingMonths(key: MonthKey, count: number): MonthKey[] {
  return Array.from({ length: count }, (_, index) => addMonths(key, index - (count - 1)));
}

export function monthsBetweenInclusive(from: MonthKey, to: MonthKey): MonthKey[] {
  const span = (to.year * 12 + to.month) - (from.year * 12 + from.month);
  if (span < 0) return [];
  return Array.from({ length: span + 1 }, (_, index) => addMonths(from, index));
}

/** Clamp a day-of-month to a month that may not have it (31st in February). */
export function dayInMonth(key: MonthKey, day: number): Date {
  const lastDay = monthEndInclusive(key).getUTCDate();
  return new Date(Date.UTC(key.year, key.month - 1, Math.min(Math.max(day, 1), lastDay)));
}

/* -------------------------------------------------------------------------- */
/* Display                                                                     */
/* -------------------------------------------------------------------------- */

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "Sep 2026" / "September 2026" / "Sep" */
export function formatMonthLabel(
  key: MonthKey,
  style: "short" | "long" | "compact" = "short",
): string {
  const name = style === "long" ? MONTHS_LONG[key.month - 1] : MONTHS_SHORT[key.month - 1];
  if (style === "compact") return name;
  return `${name} ${key.year}`;
}

/** "15 Sep 2026" */
export function formatDay(value: Date | null | undefined): string {
  if (!value) return "—";
  return `${value.getUTCDate()} ${MONTHS_SHORT[value.getUTCMonth()]} ${value.getUTCFullYear()}`;
}

/** "15 Sep" — for dense tables where the year is implied by context. */
export function formatDayShort(value: Date | null | undefined): string {
  if (!value) return "—";
  return `${value.getUTCDate()} ${MONTHS_SHORT[value.getUTCMonth()]}`;
}

/** "in 6 days" / "3 days overdue" / "today" */
export function formatRelativeDay(value: Date, today: Date): string {
  const delta = daysBetween(today, value);
  if (delta === 0) return "today";
  if (delta === 1) return "tomorrow";
  if (delta === -1) return "yesterday";
  if (delta > 0) return `in ${delta} days`;
  return `${Math.abs(delta)} days overdue`;
}
