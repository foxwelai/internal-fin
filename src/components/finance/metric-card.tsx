import Link from "next/link";
import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";
import { formatINR, formatPercent, type Paise } from "@/lib/money";
import { Money } from "@/components/finance/money";

/**
 * Actual vs forecast is the distinction the whole dashboard hangs on, so it is
 * carried by the card's own chrome — a solid brand rule for money that exists,
 * a dashed muted rule for money that is only expected — not just by wording.
 */
export type MetricKind = "actual" | "forecast" | "plan" | "neutral";

const KIND_META: Record<MetricKind, { chip: string; rule: string; chipClass: string }> = {
  actual: {
    chip: "Actual",
    rule: "bg-brand",
    chipClass: "border-brand-line bg-brand-soft text-brand",
  },
  forecast: {
    chip: "Forecast",
    rule: "bg-[repeating-linear-gradient(90deg,var(--projected)_0_5px,transparent_5px_10px)]",
    chipClass: "border-border-strong bg-surface-3 text-projected",
  },
  plan: {
    chip: "Planned",
    rule: "bg-[repeating-linear-gradient(90deg,var(--border-strong)_0_5px,transparent_5px_10px)]",
    chipClass: "border-border-strong bg-surface-3 text-muted-foreground",
  },
  neutral: { chip: "", rule: "bg-border-strong", chipClass: "" },
};

export function DeltaChip({
  percent,
  invertColours = false,
  suffix,
}: {
  percent: number | null;
  /** For cost metrics, where a rise is the bad direction. */
  invertColours?: boolean;
  suffix?: string;
}) {
  if (percent === null) {
    return (
      <span className="text-[12px] text-faint-foreground">no comparison data</span>
    );
  }

  const rising = percent > 0;
  const flat = Math.abs(percent) < 0.05;
  const good = invertColours ? !rising : rising;
  const Icon = rising ? TrendingUp : TrendingDown;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[12px] font-medium",
        flat ? "text-muted-foreground" : good ? "text-positive" : "text-negative",
      )}
    >
      {flat ? null : <Icon className="size-3" />}
      <span className="font-mono tabular">{formatPercent(percent, { signed: true })}</span>
      {suffix ? <span className="font-sans font-normal text-faint-foreground">{suffix}</span> : null}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  kind = "neutral",
  tone,
  footnote,
  delta,
  href,
  emphasis = false,
  className,
}: {
  label: string;
  value: Paise;
  kind?: MetricKind;
  tone?: "default" | "positive" | "negative" | "auto" | "muted" | "brand" | "warning";
  footnote?: React.ReactNode;
  delta?: React.ReactNode;
  /** Every card links to the records behind its total. */
  href?: string;
  emphasis?: boolean;
  className?: string;
}) {
  const meta = KIND_META[kind];

  const body = (
    <>
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-px", meta.rule)} />

      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-faint-foreground">
          {label}
        </span>
        {meta.chip ? (
          <span
            className={cn(
              "shrink-0 rounded-full border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide",
              meta.chipClass,
            )}
          >
            {meta.chip}
          </span>
        ) : null}
      </div>

      <Money
        value={value}
        tone={tone ?? "default"}
        className={cn(
          "mt-2.5 block truncate font-semibold tracking-tight",
          emphasis ? "text-[26px] leading-8 sm:text-[32px] sm:leading-10" : "text-[20px] leading-7 sm:text-[22px]",
        )}
        title={formatINR(value, { decimals: true })}
      />

      <div className="mt-2 flex min-h-[18px] flex-wrap items-center gap-x-2 gap-y-1">
        {delta}
        {footnote ? (
          <span className="text-[12px] leading-tight text-muted-foreground">{footnote}</span>
        ) : null}
      </div>

      {href ? (
        <ArrowUpRight className="absolute right-3.5 top-9 size-4 -translate-y-1 text-faint-foreground opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100" />
      ) : null}
    </>
  );

  const shell = cn(
    "group relative block overflow-hidden rounded-xl border border-border bg-card surface-sheen p-4 text-left",
    "shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_8px_24px_-16px_rgba(0,0,0,0.9)]",
    "transition-colors duration-200",
    href && "hover:border-border-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );

  if (!href) return <div className={shell}>{body}</div>;

  return (
    <Link href={href} className={shell}>
      {body}
    </Link>
  );
}
