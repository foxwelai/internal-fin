"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { formatINR, formatINRCompact } from "@/lib/money";

/**
 * Shared chart chrome.
 *
 * Charts receive amounts as integer paise, the same unit the engine works in,
 * and convert only for the axis label or tooltip. Nothing is rounded before it
 * is drawn.
 */

export const CHART_COLORS = {
  actual: "#f4551d",
  actualSoft: "rgba(244, 85, 29, 0.16)",
  projected: "#7c8ba1",
  expense: "#5b8def",
  expenseSoft: "rgba(91, 141, 239, 0.16)",
  positive: "#46b881",
  negative: "#e05561",
  grid: "rgba(35, 39, 47, 0.9)",
  axis: "#626a77",
} as const;

export const AXIS_PROPS = {
  tickLine: false,
  axisLine: false,
  tick: { fill: CHART_COLORS.axis, fontSize: 11 },
} as const;

export function moneyTick(value: number): string {
  return formatINRCompact(BigInt(Math.round(value)));
}

type TooltipRow = {
  name?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
};

/** Recharts tooltip styled to match the terminal surfaces. */
export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  footer,
}: {
  active?: boolean;
  payload?: TooltipRow[];
  label?: string | number;
  labelFormatter?: (label: string | number) => string;
  footer?: (payload: TooltipRow[]) => React.ReactNode;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border-strong bg-elevated px-3 py-2 shadow-[0_16px_48px_-16px_rgba(0,0,0,0.95)]">
      {label !== undefined ? (
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint-foreground">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      ) : null}
      <ul className="space-y-1">
        {payload.map((row, index) => (
          <li key={`${row.dataKey}-${index}`} className="flex items-center gap-2.5 text-[12px]">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: row.color }}
            />
            <span className="text-muted-foreground">{row.name}</span>
            <span className="ml-auto font-mono tabular text-foreground">
              {typeof row.value === "number" ? formatINR(BigInt(Math.round(row.value))) : "—"}
            </span>
          </li>
        ))}
      </ul>
      {footer ? <div className="mt-1.5 border-t border-border pt-1.5">{footer(payload)}</div> : null}
    </div>
  );
}

export function ChartLegend({
  items,
  className,
}: {
  items: { label: string; color: string; dashed?: boolean }[];
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          {item.dashed ? (
            <span
              aria-hidden
              className="h-0.5 w-3.5 rounded-full"
              style={{
                backgroundImage: `repeating-linear-gradient(90deg, ${item.color} 0 3px, transparent 3px 6px)`,
              }}
            />
          ) : (
            <span
              aria-hidden
              className="size-2 rounded-[2px]"
              style={{ backgroundColor: item.color }}
            />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Recharts needs measurable width. Rendering it only after mount avoids the
 * zero-width flash and gives a skeleton that matches the final height.
 *
 * The SVG a chart library emits is meaningless to a screen reader, so the
 * frame carries a spoken summary of what the chart shows. On Analytics the
 * same figures are also present as a table.
 */
export function ChartFrame({
  height = 260,
  children,
  className,
  label,
  description,
}: {
  height?: number;
  children: React.ReactNode;
  className?: string;
  label?: string;
  description?: string;
}) {
  // Recharts measures the DOM, so it renders nothing useful on the server.
  // useSyncExternalStore gives "false on the server, true on the client"
  // without a state update in an effect.
  const mounted = React.useSyncExternalStore(subscribeNever, () => true, () => false);

  return (
    <div
      className={cn("w-full", className)}
      style={{ height }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-description={description}
    >
      {mounted ? children : <div className="skeleton size-full rounded-lg" aria-hidden />}
    </div>
  );
}

/**
 * Where zero sits between the top and bottom of a series, as a 0-1 fraction.
 * Used to split a fill or stroke gradient so a deficit is never drawn in the
 * colour that means surplus.
 */
export function zeroOffset(values: readonly number[]): number {
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  if (max <= 0) return 0;
  if (min >= 0) return 1;
  return max / (max - min);
}

/**
 * A vertical gradient that is `positive` above the zero line and `negative`
 * below it, with a hard transition exactly at zero.
 */
export function SignSplitGradient({
  id,
  offset,
  topOpacity = 1,
  bottomOpacity = 1,
  fadeTo,
}: {
  id: string;
  offset: number;
  topOpacity?: number;
  bottomOpacity?: number;
  /** When set, each half fades towards the zero line at this opacity. */
  fadeTo?: number;
}) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset={0} stopColor={CHART_COLORS.positive} stopOpacity={topOpacity} />
      <stop
        offset={offset}
        stopColor={CHART_COLORS.positive}
        stopOpacity={fadeTo ?? topOpacity}
      />
      <stop
        offset={offset}
        stopColor={CHART_COLORS.negative}
        stopOpacity={fadeTo ?? bottomOpacity}
      />
      <stop offset={1} stopColor={CHART_COLORS.negative} stopOpacity={bottomOpacity} />
    </linearGradient>
  );
}

/** A store that never changes: the snapshot alone distinguishes server from client. */
const subscribeNever = () => () => {};

/** Reads a series aloud: "Apr ₹3,80,000; May ₹3,80,000; …". */
export function describeSeries(
  points: readonly { label: string; value: number }[],
  unitLabel = "",
): string {
  if (points.length === 0) return "No data.";
  const body = points
    .map((point) => `${point.label} ${formatINR(BigInt(Math.round(point.value)))}`)
    .join("; ");
  return unitLabel ? `${unitLabel}: ${body}.` : `${body}.`;
}
