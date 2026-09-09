import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";
import { formatPercent, type Paise } from "@/lib/money";
import { Money } from "@/components/finance/money";

/**
 * The month's bottom line. Deliberately labelled "cash surplus / deficit"
 * rather than "profit": this is a cash view of the business, not an accounting
 * net profit — accruals, depreciation and tax are all outside it.
 */
export function ResultCard({
  title,
  value,
  marginPercent,
  caption,
  rows,
  href,
  kind = "actual",
}: {
  title: string;
  value: Paise;
  marginPercent?: number | null;
  caption?: React.ReactNode;
  rows?: { label: string; value: React.ReactNode }[];
  href?: string;
  kind?: "actual" | "forecast";
}) {
  const positive = value >= 0n;
  const word = positive ? "surplus" : "deficit";

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card p-5",
        "shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_8px_24px_-16px_rgba(0,0,0,0.9)]",
        positive ? "border-positive/25" : "border-negative/25",
      )}
    >
      {/* A wash of the result's colour, so the month's health reads instantly. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 opacity-[0.055]",
          positive
            ? "bg-[radial-gradient(120%_100%_at_0%_0%,var(--positive),transparent_65%)]"
            : "bg-[radial-gradient(120%_100%_at_0%_0%,var(--negative),transparent_65%)]",
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-faint-foreground">
            {title}
          </span>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Cash {word}
            {kind === "forecast" ? " — projected" : ""}
          </p>
        </div>
        {href ? (
          <Link
            href={href}
            className="rounded-md p-1 text-faint-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
            aria-label={`View records behind ${title}`}
          >
            <ArrowUpRight className="size-4" />
          </Link>
        ) : null}
      </div>

      <div className="relative mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Money
          value={value}
          tone={positive ? "positive" : "negative"}
          signed
          className="text-[28px] font-semibold leading-9 tracking-tight sm:text-[34px] sm:leading-11"
        />
        {marginPercent !== undefined ? (
          <span className="font-mono tabular text-[13px] text-muted-foreground">
            {formatPercent(marginPercent)} margin
          </span>
        ) : null}
      </div>

      {caption ? (
        <p className="relative mt-2 text-[12px] leading-relaxed text-muted-foreground">{caption}</p>
      ) : null}

      {rows?.length ? (
        <dl className="relative mt-4 space-y-1.5 border-t border-border pt-3">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3">
              <dt className="text-[12px] text-muted-foreground">{row.label}</dt>
              <dd className="text-[13px]">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
