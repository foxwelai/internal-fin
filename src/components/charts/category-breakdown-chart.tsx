"use client";

import * as React from "react";
import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { ChartFrame, ChartTooltip } from "./chart-kit";
import { Money } from "@/components/finance/money";
import { formatPercent } from "@/lib/money";

export type CategorySlice = {
  category: string;
  label: string;
  color: string;
  plannedPaise: number;
  paidPaise: number;
  share: number | null;
  href: string;
};

/**
 * Where the month's budget goes. The ring carries the shape; the list beside
 * it carries the exact figures, because a reader needs both.
 */
export function CategoryBreakdownChart({ data }: { data: CategorySlice[] }) {
  const [active, setActive] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <ChartFrame
        height={160}
        className="sm:w-[160px] sm:shrink-0"
        label="Ring chart of planned expenditure by category. The same figures are listed beside it."
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="plannedPaise"
              nameKey="label"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
              onMouseEnter={(_, index) => setActive(data[index]?.category ?? null)}
              onMouseLeave={() => setActive(null)}
            >
              {data.map((slice) => (
                <Cell
                  key={slice.category}
                  fill={slice.color}
                  opacity={active === null || active === slice.category ? 1 : 0.35}
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ul className="min-w-0 flex-1 space-y-1">
        {data.map((slice) => (
          <li key={slice.category}>
            <Link
              href={slice.href}
              onMouseEnter={() => setActive(slice.category)}
              onMouseLeave={() => setActive(null)}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-2"
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: slice.color }}
              />
              <span className="min-w-0 flex-1 truncate text-[13px]">{slice.label}</span>
              <span className="shrink-0 font-mono tabular text-[11px] text-faint-foreground">
                {formatPercent(slice.share)}
              </span>
              <Money
                value={BigInt(slice.plannedPaise)}
                compact
                className="w-16 shrink-0 text-right text-[13px]"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
