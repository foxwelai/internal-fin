"use client";

import { useSearchParams } from "next/navigation";

import { formatMonthKey, parseMonthKey, type MonthKey } from "@/lib/dates";

/**
 * The globally selected month, read from `?month=YYYY-MM`.
 *
 * Layout components cannot receive searchParams in the App Router, so the top
 * bar reads the URL directly while pages read their own `searchParams` prop.
 * Both resolve to the same value.
 */
export function useSelectedMonth(fallback: MonthKey): MonthKey {
  const searchParams = useSearchParams();
  return parseMonthKey(searchParams.get("month")) ?? fallback;
}

export function useSelectedMonthParam(fallback: MonthKey): string {
  return formatMonthKey(useSelectedMonth(fallback));
}
