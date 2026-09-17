"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AXIS_PROPS, CHART_COLORS, ChartFrame, ChartLegend, ChartTooltip, describeSeries, moneyTick } from "./chart-kit";

export type LeadProjectionPoint = {
  label: string;
  /** Paise, as numbers for the chart. */
  weighted: number;
  pipeline: number;
  count: number;
};

/**
 * Open leads by the month they should close: full value beside the value
 * weighted by each lead's chance of closing. Plan on the second bar.
 */
export function LeadProjectionChart({ data }: { data: LeadProjectionPoint[] }) {
  return (
    <div>
      <ChartLegend
        className="mb-3"
        items={[
          { label: "Likely (weighted)", color: CHART_COLORS.actual },
          { label: "Full pipeline", color: CHART_COLORS.projected },
        ]}
      />
      <ChartFrame
        height={250}
        label={`Bar chart of lead value expected to close in each of ${data.length} periods, full and weighted by likelihood.`}
        description={describeSeries(
          data.map((point) => ({ label: point.label, value: point.weighted })),
          "Weighted projection",
        )}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }} barGap={2}>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis dataKey="label" {...AXIS_PROPS} interval={0} />
            <YAxis {...AXIS_PROPS} tickFormatter={moneyTick} width={58} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.035)" }}
              content={
                <ChartTooltip
                  footer={(rows) => {
                    const count = Number(rows[0]?.payload?.count ?? 0);
                    return (
                      <span className="text-[11px] text-faint-foreground">
                        {count} open lead{count === 1 ? "" : "s"}
                      </span>
                    );
                  }}
                />
              }
            />
            <Bar
              dataKey="pipeline"
              name="Full pipeline"
              fill={CHART_COLORS.projected}
              fillOpacity={0.45}
              radius={[3, 3, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            />
            <Bar
              dataKey="weighted"
              name="Likely (weighted)"
              fill={CHART_COLORS.actual}
              radius={[3, 3, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}
