import Link from "next/link";
import type { Metadata } from "next";
import { BarChart3, Download } from "lucide-react";

import { PageHeader } from "@/components/finance/page-header";
import { MetricCard } from "@/components/finance/metric-card";
import { InsightsStrip } from "@/components/finance/insights-strip";
import { EmptyState } from "@/components/finance/empty-state";
import { Money } from "@/components/finance/money";
import { RangeSelector, type RangePreset } from "@/components/finance/range-selector";
import { CollectionsExpensesChart } from "@/components/charts/collections-expenses-chart";
import { CategoryBreakdownChart } from "@/components/charts/category-breakdown-chart";
import {
  PlannedVsPaidChart,
  ProjectedVsActualChart,
  RankedBarChart,
  SurplusTrendChart,
} from "@/components/charts/trend-chart";
import { PipelineCard } from "@/components/finance/pipeline-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrap,
} from "@/components/ui/table";

import {
  addMonths,
  compareMonthKeys,
  formatMonthKey,
  formatMonthLabel,
  monthsBetweenInclusive,
  parseMonthKey,
  type MonthKey,
} from "@/lib/dates";
import { formatPercent, percentOf, toWire } from "@/lib/money";
import { loadFinanceIndex } from "@/lib/finance/repository";
import {
  clientTotals,
  expenseCategoryBreakdown,
  pipelineTotals,
  receivablesAgeing,
  summariseMonth,
} from "@/lib/finance/engine";
import { buildInsights } from "@/lib/finance/insights";
import {
  EXPENSE_CATEGORY_COLORS,
  EXPENSE_CATEGORY_SHORT_LABELS,
} from "@/lib/finance/labels";
import { readParam, resolveMonth, type SearchParams } from "@/lib/finance/page-helpers";

export const metadata: Metadata = { title: "Analytics" };

/** Resolves the preset into an inclusive list of months. */
function resolveRange(
  preset: RangePreset,
  month: MonthKey,
  fromParam: string | undefined,
  toParam: string | undefined,
): { months: MonthKey[]; from: MonthKey; to: MonthKey } {
  if (preset === "custom") {
    const from = parseMonthKey(fromParam) ?? addMonths(month, -5);
    const to = parseMonthKey(toParam) ?? month;
    const [start, end] = compareMonthKeys(from, to) <= 0 ? [from, to] : [to, from];
    // Guard against an accidental decade-long range.
    const capped = monthsBetweenInclusive(start, end).slice(0, 36);
    return { months: capped, from: start, to: capped[capped.length - 1] ?? end };
  }

  if (preset === "month") return { months: [month], from: month, to: month };

  if (preset === "quarter") {
    const startMonth = Math.floor((month.month - 1) / 3) * 3 + 1;
    const from = { year: month.year, month: startMonth };
    const to = addMonths(from, 2);
    return { months: monthsBetweenInclusive(from, to), from, to };
  }

  const from = { year: month.year, month: 1 };
  const to = { year: month.year, month: 12 };
  return { months: monthsBetweenInclusive(from, to), from, to };
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const month = resolveMonth(params);
  const preset = (["month", "quarter", "year", "custom"].includes(readParam(params, "range") ?? "")
    ? readParam(params, "range")
    : "quarter") as RangePreset;

  const { months, from, to } = resolveRange(
    preset,
    month,
    readParam(params, "from"),
    readParam(params, "to"),
  );

  const index = await loadFinanceIndex();
  const summaries = months.map((key) => ({ key, summary: summariseMonth(index, key) }));

  const rangeLabel =
    months.length === 1
      ? formatMonthLabel(from, "long")
      : `${formatMonthLabel(from, "short")} – ${formatMonthLabel(to, "short")}`;

  /* ------------------------------- Totals -------------------------------- */

  const totals = summaries.reduce(
    (acc, row) => ({
      collections: acc.collections + row.summary.actualCollectionsPaise,
      outflow: acc.outflow + row.summary.actualCashOutflowPaise,
      planned: acc.planned + row.summary.plannedExpensesPaise,
      projected: acc.projected + row.summary.projectedCollectionsPaise,
    }),
    { collections: 0n, outflow: 0n, planned: 0n, projected: 0n },
  );
  const surplus = totals.collections - totals.outflow;

  /* ------------------------------- Series -------------------------------- */

  const series = summaries.map(({ key, summary }) => ({
    month: formatMonthKey(key),
    label: formatMonthLabel(key, months.length > 12 ? "compact" : "compact"),
    collections: toWire(summary.actualCollectionsPaise),
    expenses: toWire(summary.actualCashOutflowPaise),
    surplus: toWire(summary.actualSurplusPaise),
  }));

  const projectedVsActual = summaries.map(({ key, summary }) => ({
    label: formatMonthLabel(key, "compact"),
    actual: toWire(summary.actualCollectionsPaise),
    projected: toWire(summary.projectedCollectionsPaise),
  }));

  /* ---------------------------- Breakdowns ------------------------------- */

  const categoryTotals = new Map<string, { planned: bigint; paid: bigint }>();
  for (const { key } of summaries) {
    for (const row of expenseCategoryBreakdown(index, key)) {
      const current = categoryTotals.get(row.category) ?? { planned: 0n, paid: 0n };
      current.planned += row.plannedPaise;
      current.paid += row.paidPaise;
      categoryTotals.set(row.category, current);
    }
  }
  const plannedGrandTotal = [...categoryTotals.values()].reduce((sum, row) => sum + row.planned, 0n);

  const categorySlices = [...categoryTotals.entries()]
    .sort((a, b) => (b[1].planned > a[1].planned ? 1 : b[1].planned < a[1].planned ? -1 : 0))
    .map(([category, row]) => ({
      category,
      label: EXPENSE_CATEGORY_SHORT_LABELS[category as keyof typeof EXPENSE_CATEGORY_SHORT_LABELS],
      color: EXPENSE_CATEGORY_COLORS[category as keyof typeof EXPENSE_CATEGORY_COLORS],
      plannedPaise: toWire(row.planned),
      paidPaise: toWire(row.paid),
      share: percentOf(row.planned, plannedGrandTotal),
      href: `/expenses?month=${formatMonthKey(to)}&category=${category}`,
    }));

  const plannedVsPaid = categorySlices.map((row) => ({
    label: row.label,
    planned: row.plannedPaise,
    paid: row.paidPaise,
    color: row.color,
  }));

  const clients = clientTotals(index);
  const revenueByClient = clients
    .filter((row) => row.collectedPaise > 0n)
    .slice(0, 8)
    .map((row) => ({ label: row.clientName, value: toWire(row.collectedPaise) }));

  const outstandingByClient = clients
    .filter((row) => row.outstandingPaise > 0n)
    .sort((a, b) => (b.outstandingPaise > a.outstandingPaise ? 1 : -1))
    .slice(0, 8)
    .map((row) => ({ label: row.clientName, value: toWire(row.outstandingPaise) }));

  const ageing = receivablesAgeing(index);
  const ageingData = ageing
    .filter((row) => row.amountPaise > 0n)
    .map((row) => ({ label: row.label, value: toWire(row.amountPaise) }));

  const insights = buildInsights(index, month, summariseMonth(index, month));
  const hasData = summaries.some((row) => !row.summary.isEmpty);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        description={
          <>
            {rangeLabel}. Every figure is derived from stored records — the commentary below is
            generated by fixed rules, never written by a model.
          </>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/api/export/payments?month=${formatMonthKey(to)}&view=received`}>
              <Download />
              Export receipts
            </Link>
          </Button>
        }
      />

      <RangeSelector
        preset={preset}
        from={readParam(params, "from") ?? formatMonthKey(from)}
        to={readParam(params, "to") ?? formatMonthKey(to)}
      />

      {!hasData ? (
        <EmptyState
          icon={BarChart3}
          title={`No activity in ${rangeLabel}`}
          description="Pick a different range, or record some receipts and expenses first."
        />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Collected in range"
              value={totals.collections}
              kind="actual"
              emphasis
              href={`/payments?month=${formatMonthKey(to)}&view=received`}
            />
            <MetricCard
              label="Paid out in range"
              value={totals.outflow}
              kind="actual"
              emphasis
              href={`/expenses?month=${formatMonthKey(to)}`}
            />
            <MetricCard
              label="Cash surplus / deficit"
              value={surplus}
              kind="actual"
              tone={surplus >= 0n ? "positive" : "negative"}
              emphasis
              footnote={`${formatPercent(percentOf(surplus, totals.collections))} margin`}
            />
            <MetricCard
              label="Planned expenses in range"
              value={totals.planned}
              kind="plan"
              emphasis
              footnote={`across ${months.length} month${months.length === 1 ? "" : "s"}`}
            />
          </section>

          <section aria-label="Insights">
            <InsightsStrip insights={insights} />
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Collections versus paid expenses</CardTitle>
                <p className="text-[13px] text-muted-foreground">
                  Money in and money out, by the month it moved.
                </p>
              </CardHeader>
              <CardContent>
                <CollectionsExpensesChart data={series} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cash surplus / deficit trend</CardTitle>
                <p className="text-[13px] text-muted-foreground">
                  Collections less cash actually paid out, month by month.
                </p>
              </CardHeader>
              <CardContent>
                <SurplusTrendChart data={series.map((row) => ({ label: row.label, surplus: row.surplus }))} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Projected versus actual collections</CardTitle>
                <p className="text-[13px] text-muted-foreground">
                  How closely the schedule predicted what arrived. A short bar beside a tall one is
                  a month the forecast overshot.
                </p>
              </CardHeader>
              <CardContent>
                <ProjectedVsActualChart data={projectedVsActual} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expense breakdown by category</CardTitle>
                <p className="text-[13px] text-muted-foreground">Planned spend across {rangeLabel}.</p>
              </CardHeader>
              <CardContent>
                {categorySlices.length === 0 ? (
                  <EmptyState title="No expenses budgeted in this range" compact />
                ) : (
                  <CategoryBreakdownChart data={categorySlices} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Planned versus paid, by category</CardTitle>
                <p className="text-[13px] text-muted-foreground">
                  Where the budget was set against what actually left the account.
                </p>
              </CardHeader>
              <CardContent>
                {plannedVsPaid.length === 0 ? (
                  <EmptyState title="Nothing budgeted in this range" compact />
                ) : (
                  <PlannedVsPaidChart data={plannedVsPaid} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue collected by client</CardTitle>
                <p className="text-[13px] text-muted-foreground">
                  All-time receipts, largest first.
                </p>
              </CardHeader>
              <CardContent>
                {revenueByClient.length === 0 ? (
                  <EmptyState title="No receipts recorded yet" compact />
                ) : (
                  <RankedBarChart
                    data={revenueByClient}
                    label="Horizontal bar chart of revenue collected from each client, largest first."
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Outstanding payments by client</CardTitle>
                <p className="text-[13px] text-muted-foreground">
                  Unpaid schedule on approved projects.
                </p>
              </CardHeader>
              <CardContent>
                {outstandingByClient.length === 0 ? (
                  <EmptyState title="Nothing outstanding" compact />
                ) : (
                  <RankedBarChart
                    data={outstandingByClient}
                    color="#e08a3c"
                    label="Horizontal bar chart of outstanding scheduled payments by client."
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Overdue payment ageing</CardTitle>
                <p className="text-[13px] text-muted-foreground">
                  Unpaid scheduled amounts by how long they have been due.
                </p>
              </CardHeader>
              <CardContent>
                {ageingData.length === 0 ? (
                  <EmptyState title="Nothing outstanding" compact />
                ) : (
                  <RankedBarChart
                    data={ageingData}
                    color="#e05561"
                    height={200}
                    label="Horizontal bar chart of unpaid scheduled amounts grouped by how long they have been due."
                  />
                )}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-3 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Project pipeline by status</CardTitle>
              </CardHeader>
              <CardContent>
                <PipelineCard totals={pipelineTotals(index)} />
              </CardContent>
            </Card>

            <Card className="overflow-hidden lg:col-span-2">
              <CardHeader>
                <CardTitle>Month by month</CardTitle>
                <p className="text-[13px] text-muted-foreground">
                  The records behind every chart above.
                </p>
              </CardHeader>
              <TableWrap>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Collected</TableHead>
                      <TableHead className="text-right">Projected</TableHead>
                      <TableHead className="text-right">Planned</TableHead>
                      <TableHead className="text-right">Paid out</TableHead>
                      <TableHead className="text-right">Surplus</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaries.map(({ key, summary }) => (
                      <TableRow key={formatMonthKey(key)}>
                        <TableCell>
                          <Link
                            href={`/overview?month=${formatMonthKey(key)}`}
                            className="text-[13px] hover:text-brand"
                          >
                            {formatMonthLabel(key, "short")}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">
                          <Money value={summary.actualCollectionsPaise} className="text-[13px]" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Money
                            value={summary.projectedCollectionsPaise}
                            tone="muted"
                            className="text-[13px]"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Money
                            value={summary.plannedExpensesPaise}
                            tone="muted"
                            className="text-[13px]"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Money value={summary.actualCashOutflowPaise} className="text-[13px]" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Money
                            value={summary.actualSurplusPaise}
                            tone={summary.actualSurplusPaise >= 0n ? "positive" : "negative"}
                            signed
                            className="text-[13px]"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono tabular text-[13px] text-muted-foreground">
                          {formatPercent(summary.surplusMarginPercent)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrap>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
