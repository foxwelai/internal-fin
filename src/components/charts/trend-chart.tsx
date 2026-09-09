"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
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

export type TrendPoint = {
  label: string;
  surplus: number;
};

/**
 * Cash surplus / deficit over time. The fill and the line are split at zero, so
 * a deficit month is never drawn in the colour that means surplus.
 */
export function SurplusTrendChart({ data }: { data: TrendPoint[] }) {
  const gradientId = React.useId();
  const fillId = `${gradientId}-fill`;
  const strokeId = `${gradientId}-stroke`;
  const offset = zeroOffset(data.map((point) => point.surplus));

  return (
    <ChartFrame
      height={240}
      label="Area chart of cash surplus or deficit over time."
      description={describeSeries(data.map((p) => ({ label: p.label, value: p.surplus })), "Surplus")}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
          <defs>
            <SignSplitGradient id={fillId} offset={offset} topOpacity={0.35} bottomOpacity={0.35} fadeTo={0.03} />
            <SignSplitGradient id={strokeId} offset={offset} />
          </defs>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="label" {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} tickFormatter={moneyTick} width={58} />
          <ReferenceLine y={0} stroke={CHART_COLORS.axis} strokeDasharray="3 3" />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="surplus"
            name="Cash surplus"
            stroke={`url(#${strokeId})`}
            strokeWidth={2}
            fill={`url(#${fillId})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export type ProjectedActualPoint = {
  label: string;
  actual: number;
  projected: number;
};

/**
 * How well the forecast held up: what was projected for a month against what
 * actually arrived. Past months are the honest test of the schedule.
 */
export function ProjectedVsActualChart({ data }: { data: ProjectedActualPoint[] }) {
  return (
    <div>
      <ChartLegend
        className="mb-3"
        items={[
          { label: "Actually collected", color: CHART_COLORS.actual },
          { label: "Projected", color: CHART_COLORS.projected, dashed: true },
        ]}
      />
      <ChartFrame
        height={240}
        label="Grouped bar chart comparing projected collections against what was actually collected, month by month."
        description={
          describeSeries(data.map((p) => ({ label: p.label, value: p.actual })), "Actually collected") +
          " " +
          describeSeries(data.map((p) => ({ label: p.label, value: p.projected })), "Projected")
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis dataKey="label" {...AXIS_PROPS} />
            <YAxis {...AXIS_PROPS} tickFormatter={moneyTick} width={58} />
            <Tooltip cursor={{ fill: "rgba(255,255,255,0.035)" }} content={<ChartTooltip />} />
            <Bar
              dataKey="projected"
              name="Projected"
              fill={CHART_COLORS.projected}
              fillOpacity={0.45}
              radius={[3, 3, 0, 0]}
              maxBarSize={26}
              isAnimationActive={false}
            />
            <Bar
              dataKey="actual"
              name="Actually collected"
              fill={CHART_COLORS.actual}
              radius={[3, 3, 0, 0]}
              maxBarSize={26}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}

export type PlannedVsPaidPoint = {
  label: string;
  planned: number;
  paid: number;
  color: string;
};

/** Category budget against what was actually settled. */
export function PlannedVsPaidChart({ data }: { data: PlannedVsPaidPoint[] }) {
  return (
    <div>
      <ChartLegend
        className="mb-3"
        items={[
          { label: "Planned", color: CHART_COLORS.projected, dashed: true },
          { label: "Paid", color: CHART_COLORS.expense },
        ]}
      />
      <ChartFrame
        height={Math.max(200, data.length * 38 + 24)}
        label="Horizontal bar chart of planned versus paid expenditure for each category."
        description={
          describeSeries(data.map((p) => ({ label: p.label, value: p.planned })), "Planned") +
          " " +
          describeSeries(data.map((p) => ({ label: p.label, value: p.paid })), "Paid")
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 12, bottom: 0, left: 8 }}
            barGap={2}
          >
            <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
            <XAxis type="number" {...AXIS_PROPS} tickFormatter={moneyTick} />
            <YAxis type="category" dataKey="label" {...AXIS_PROPS} width={110} />
            <Tooltip cursor={{ fill: "rgba(255,255,255,0.035)" }} content={<ChartTooltip />} />
            <Bar
              dataKey="planned"
              name="Planned"
              fill={CHART_COLORS.projected}
              fillOpacity={0.4}
              radius={[0, 3, 3, 0]}
              maxBarSize={12}
              isAnimationActive={false}
            />
            <Bar
              dataKey="paid"
              name="Paid"
              radius={[0, 3, 3, 0]}
              maxBarSize={12}
              isAnimationActive={false}
            >
              {data.map((row) => (
                <Cell key={row.label} fill={row.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}

export type HorizontalBarPoint = {
  label: string;
  value: number;
  href?: string;
};

/** Generic ranked bar chart — revenue by client, outstanding by client, ageing. */
export function RankedBarChart({
  data,
  color = CHART_COLORS.actual,
  height,
  label,
}: {
  data: HorizontalBarPoint[];
  color?: string;
  height?: number;
  label?: string;
}) {
  return (
    <ChartFrame
      height={height ?? Math.max(180, data.length * 34 + 24)}
      label={label ?? "Ranked horizontal bar chart."}
      description={describeSeries(data)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 12, bottom: 0, left: 8 }}
        >
          <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
          <XAxis type="number" {...AXIS_PROPS} tickFormatter={moneyTick} />
          <YAxis type="category" dataKey="label" {...AXIS_PROPS} width={120} />
          <Tooltip cursor={{ fill: "rgba(255,255,255,0.035)" }} content={<ChartTooltip />} />
          <Bar
            dataKey="value"
            name="Amount"
            fill={color}
            radius={[0, 3, 3, 0]}
            maxBarSize={18}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
