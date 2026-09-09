/**
 * Money primitives.
 *
 * Every amount in this application is an integer number of paise held in a
 * `bigint`. No float ever touches a monetary value: parsing, arithmetic,
 * aggregation and formatting are all integer operations. Floats appear only
 * where a value is handed to a chart library for pixel positioning.
 */

export type Paise = bigint;

export const ZERO: Paise = 0n;

/** Amounts crossing the server/client boundary travel as integer paise. */
export type PaiseWire = number;

const MAX_SAFE_PAISE = BigInt(Number.MAX_SAFE_INTEGER);

/** Serialise for a client component / JSON payload. Still an exact integer. */
export function toWire(p: Paise): PaiseWire {
  if (p > MAX_SAFE_PAISE || p < -MAX_SAFE_PAISE) {
    throw new Error(`Amount ${p} exceeds the safe integer range for transport`);
  }
  return Number(p);
}

export function fromWire(p: PaiseWire): Paise {
  return BigInt(Math.trunc(p));
}

export function sum(values: Iterable<Paise>): Paise {
  let total = 0n;
  for (const v of values) total += v;
  return total;
}

export function sumBy<T>(items: readonly T[], pick: (item: T) => Paise): Paise {
  let total = 0n;
  for (const item of items) total += pick(item);
  return total;
}

/** Never let a derived "remaining"/"outstanding" figure go negative. */
export function clampToZero(p: Paise): Paise {
  return p < 0n ? 0n : p;
}

export function minPaise(a: Paise, b: Paise): Paise {
  return a < b ? a : b;
}

export function maxPaise(a: Paise, b: Paise): Paise {
  return a > b ? a : b;
}

export function abs(p: Paise): Paise {
  return p < 0n ? -p : p;
}

export const rupees = (n: number | string): Paise => parseRupeesToPaise(String(n));

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

export class MoneyParseError extends Error {}

/**
 * Parse user input into paise. Accepts Indian grouping, a leading ₹, spaces
 * and an optional two-decimal paise part: "₹1,25,000.50" -> 12500050n.
 *
 * Rejects anything with more than two decimal places rather than silently
 * rounding, so a mistyped amount surfaces as a validation error.
 */
export function parseRupeesToPaise(input: string): Paise {
  const raw = String(input ?? "").trim();
  if (raw === "") throw new MoneyParseError("Enter an amount");

  const cleaned = raw.replace(/[₹\s,_]/g, "");
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) {
    if (/^-?\d+\.\d{3,}$/.test(cleaned)) {
      throw new MoneyParseError("Use at most two decimal places (paise)");
    }
    throw new MoneyParseError("Enter a valid amount, for example 1,25,000");
  }

  const [, negative, whole, fraction = ""] = match;
  const paisePart = (fraction + "00").slice(0, 2);
  const magnitude = BigInt(whole) * 100n + BigInt(paisePart);
  return negative ? -magnitude : magnitude;
}

/** Lenient variant for CSV import: returns null instead of throwing. */
export function tryParseRupeesToPaise(input: string): Paise | null {
  try {
    return parseRupeesToPaise(input);
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

/** 1234567 -> "12,34,567" (last three digits, then pairs). */
export function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3);
  const tail = digits.slice(-3);
  const grouped = head.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${grouped},${tail}`;
}

export type MoneyFormatOptions = {
  /** Show the ".00" paise part. Off by default — the terminal reads cleaner. */
  decimals?: boolean;
  /** Drop the ₹ symbol (for CSV columns and axis ticks). */
  symbol?: boolean;
  /** Always render a leading + or −. */
  signed?: boolean;
};

/** "₹1,25,000" / "−₹4,500" / "+₹12,000.50" */
export function formatINR(value: Paise, options: MoneyFormatOptions = {}): string {
  const { decimals = false, symbol = true, signed = false } = options;
  const negative = value < 0n;
  const magnitude = negative ? -value : value;

  const wholeRupees = magnitude / 100n;
  const paisePart = magnitude % 100n;
  const shouldShowDecimals = decimals || paisePart !== 0n;

  let body = groupIndian(wholeRupees.toString());
  if (shouldShowDecimals) body += `.${paisePart.toString().padStart(2, "0")}`;
  if (symbol) body = `₹${body}`;

  if (negative) return `−${body}`;
  if (signed && value > 0n) return `+${body}`;
  return body;
}

/**
 * Compact Indian notation for axis ticks and dense cards.
 * ₹1,25,000 -> "₹1.25L"; ₹2,40,00,000 -> "₹2.4Cr".
 * Integer maths throughout — the divide happens on bigints.
 */
export function formatINRCompact(value: Paise, options: { symbol?: boolean } = {}): string {
  const { symbol = true } = options;
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  const wholeRupees = magnitude / 100n;

  const CRORE = 10_000_000n;
  const LAKH = 100_000n;
  const THOUSAND = 1_000n;

  let body: string;
  if (wholeRupees >= CRORE) body = `${twoDecimals(wholeRupees, CRORE)}Cr`;
  else if (wholeRupees >= LAKH) body = `${twoDecimals(wholeRupees, LAKH)}L`;
  else if (wholeRupees >= THOUSAND) body = `${twoDecimals(wholeRupees, THOUSAND)}K`;
  else body = wholeRupees.toString();

  if (symbol) body = `₹${body}`;
  return negative ? `−${body}` : body;
}

/** value/scale to at most two decimals, trailing zeros trimmed, no floats. */
function twoDecimals(value: bigint, scale: bigint): string {
  const scaled = (value * 100n) / scale;
  const whole = scaled / 100n;
  const frac = scaled % 100n;
  if (frac === 0n) return whole.toString();
  const fracText = frac.toString().padStart(2, "0").replace(/0$/, "");
  return `${whole}.${fracText}`;
}

/** Plain "125000.00" for CSV export — machine readable, no separators. */
export function formatForCsv(value: Paise): string {
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  const body = `${magnitude / 100n}.${(magnitude % 100n).toString().padStart(2, "0")}`;
  return negative ? `-${body}` : body;
}

/**
 * Rupees as a float, for chart geometry only. Never feed the result back into
 * a stored or displayed total.
 */
export function toRupeesForChart(value: Paise): number {
  return Number(value) / 100;
}

/* -------------------------------------------------------------------------- */
/* Ratios                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Percentage of `part` within `whole`, to one decimal place.
 * Returns null when `whole` is zero — every caller renders "—" for that,
 * which is what keeps zero-income months from producing NaN or Infinity.
 */
export function percentOf(part: Paise, whole: Paise): number | null {
  if (whole === 0n) return null;
  const scaled = (part * 1000n) / whole; // tenths of a percent
  return Number(scaled) / 10;
}

export function formatPercent(value: number | null, options: { signed?: boolean } = {}): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  const sign = options.signed && rounded > 0 ? "+" : "";
  return `${sign}${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}
