"use client";

import * as React from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  AXIS_PROPS,
  CHART_COLORS,
  ChartFrame,
  ChartLegend,
  ChartTooltip,
  describeSeries,
  moneyTick,
  SignSplitGradient,
  zeroOffset,
} from "./chart-kit";

export type MonthlySeriesPoint = {
  month: string;
  label: string;
  collections: number;
  expenses: number;
  surplus: number;
};

/**
 * Six months of collections against cash actually paid out, with the resulting
 * surplus traced over the top. Both bars are *actuals* — no forecast is mixed
 * into a history chart.
 */
export function CollectionsExpensesChart({ data }: { data: MonthlySeriesPoint[] }) {
  const strokeId = `${React.useId()}-surplus`;
  const offset = zeroOffset(data.map((point) => point.surplus));

  return (
    <div>
      <ChartLegend
        className="mb-3"
        items={[
          { label: "Collected", color: CHART_COLORS.actual },
          { label: "Expenses paid", color: CHART_COLORS.expense },
          { label: "Cash surplus", color: CHART_COLORS.positive },
        ]}
      />
      <ChartFrame
        height={268}
        label={`Bar chart comparing money collected against expenses paid across ${data.length} months, with the resulting cash surplus traced over it.`}
        description={
          describeSeries(
            data.map((point) => ({ label: point.label, value: point.collections })),
            "Collected",
          ) +
          " " +
          describeSeries(
            data.map((point) => ({ label: point.label, value: point.expenses })),
            "Expenses paid",
          )
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
            <defs>
              <SignSplitGradient id={strokeId} offset={offset} />
            </defs>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis dataKey="label" {...AXIS_PROPS} />
            <YAxis {...AXIS_PROPS} tickFormatter={moneyTick} width={58} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.035)" }}
              content={<ChartTooltip />}
            />
            <Bar
              dataKey="collections"
              name="Collected"
              fill={CHART_COLORS.actual}
              radius={[3, 3, 0, 0]}
              maxBarSize={26}
              isAnimationActive={false}
            />
            <Bar
              dataKey="expenses"
              name="Expenses paid"
              fill={CHART_COLORS.expense}
              radius={[3, 3, 0, 0]}
              maxBarSize={26}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="surplus"
              name="Cash surplus"
              stroke={`url(#${strokeId})`}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: CHART_COLORS.positive, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}
