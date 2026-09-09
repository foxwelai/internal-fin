"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addMonths,
  compareMonthKeys,
  formatMonthKey,
  formatMonthLabel,
  parseMonthKey,
  type MonthKey,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * The global month. Lives in the URL (`?month=YYYY-MM`) so every page reads
 * the same value, the back button works, and a filtered view can be shared or
 * bookmarked.
 */
export function MonthSelector({
  currentMonth,
  className,
}: {
  /** Today's month — the fallback when the URL carries no selection. */
  currentMonth: MonthKey;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const month = parseMonthKey(searchParams.get("month")) ?? currentMonth;

  const go = (next: MonthKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", formatMonthKey(next));
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  };

  // 18 months back, 6 forward — enough to review history and plan ahead.
  const options: MonthKey[] = Array.from({ length: 25 }, (_, index) =>
    addMonths(currentMonth, 6 - index),
  );
  if (!options.some((option) => compareMonthKeys(option, month) === 0)) options.unshift(month);

  const isCurrent = compareMonthKeys(month, currentMonth) === 0;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5 sm:flex-none sm:gap-1",
        pending && "opacity-60",
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => go(addMonths(month, -1))}
        aria-label="Previous month"
      >
        <ChevronLeft />
      </Button>

      <Select value={formatMonthKey(month)} onValueChange={(value) => {
        const parsed = parseMonthKey(value);
        if (parsed) go(parsed);
      }}>
        <SelectTrigger
          className="h-8 w-full min-w-0 border-0 bg-transparent px-1.5 text-[13px] font-medium shadow-none hover:bg-surface-3 focus:ring-0 sm:w-[9.5rem] sm:px-2 sm:text-sm"
          aria-label="Select month"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="center" className="max-h-80">
          {options.map((option) => {
            const key = formatMonthKey(option);
            const relation = compareMonthKeys(option, currentMonth);
            return (
              <SelectItem key={key} value={key}>
                <span className="flex w-full items-center justify-between gap-3">
                  <span>{formatMonthLabel(option, "short")}</span>
                  {relation === 0 ? (
                    <span className="text-[10px] uppercase tracking-wide text-brand">now</span>
                  ) : relation > 0 ? (
                    <span className="text-[10px] uppercase tracking-wide text-faint-foreground">
                      future
                    </span>
                  ) : null}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => go(addMonths(month, 1))}
        aria-label="Next month"
      >
        <ChevronRight />
      </Button>

      {!isCurrent ? (
        <Button
          variant="ghost"
          size="sm"
          className="hidden h-8 px-2 text-[12px] text-brand hover:text-brand-hover sm:inline-flex"
          onClick={() => go(currentMonth)}
        >
          Today
        </Button>
      ) : null}
    </div>
  );
}
