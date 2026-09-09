import { currentMonthKey, parseMonthKey, type MonthKey } from "@/lib/dates";

export type SearchParams = Record<string, string | string[] | undefined>;

export function readParam(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

/** The globally selected month, or the current one when the URL says nothing. */
export function resolveMonth(params: SearchParams): MonthKey {
  return parseMonthKey(readParam(params, "month")) ?? currentMonthKey();
}

/** Preserves the month while changing another query parameter. */
export function withParams(base: SearchParams, changes: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(base)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single !== undefined) search.set(key, single);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) search.delete(key);
    else search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}
