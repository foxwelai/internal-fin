import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CalendarClock, TriangleAlert } from "lucide-react";

import { PageHeader, SectionHeading } from "@/components/finance/page-header";
import { MetricCard, DeltaChip } from "@/components/finance/metric-card";
import { ResultCard } from "@/components/finance/result-card";
import { CashBalanceCard } from "@/components/finance/cash-balance-card";
import { InsightsStrip } from "@/components/finance/insights-strip";
import { PipelineCard } from "@/components/finance/pipeline-card";
import { ScheduleList, type ScheduleListRow } from "@/components/finance/schedule-list";
import { CollectionsExpensesChart } from "@/components/charts/collections-expenses-chart";
import { CategoryBreakdownChart } from "@/components/charts/category-breakdown-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/finance/empty-state";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/finance/money";

import {
  addMonths,
  compareDates,
  formatMonthKey,
  formatMonthLabel,
  monthEndInclusive,
  monthStart,
  trailingMonths,
} from "@/lib/dates";
import { toWire } from "@/lib/money";
import { loadFinanceIndex } from "@/lib/finance/repository";
import {
  cashPositionAsOf,
  commissionsPayablePaise,
  compareToPreviousMonth,
  expenseCategoryBreakdown,
  forecastableScheduleRollups,
  loanTotals,
  pipelineTotals,
  summariseMonth,
} from "@/lib/finance/engine";
import { buildInsights } from "@/lib/finance/insights";
import {
  EXPENSE_CATEGORY_COLORS,
  EXPENSE_CATEGORY_SHORT_LABELS,
} from "@/lib/finance/labels";
import { resolveMonth, type SearchParams } from "@/lib/finance/page-helpers";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const month = resolveMonth(params);
  const monthParam = formatMonthKey(month);
  const monthLabel = formatMonthLabel(month, "long");

  const index = await loadFinanceIndex();
  const summary = summariseMonth(index, month);
  const comparison = compareToPreviousMonth(index, summary, addMonths(month, -1));
  const previousLabel = formatMonthLabel(addMonths(month, -1), "compact");

  /* ------------------------------- Charts -------------------------------- */

  const series = trailingMonths(month, 6).map((key) => {
    const point = summariseMonth(index, key);
    return {
      month: formatMonthKey(key),
      label: formatMonthLabel(key, "compact"),
      collections: toWire(point.actualCollectionsPaise),
      expenses: toWire(point.actualCashOutflowPaise),
      surplus: toWire(point.actualSurplusPaise),
    };
  });

  const categories = expenseCategoryBreakdown(index, month).map((row) => ({
    category: row.category,
    label: EXPENSE_CATEGORY_SHORT_LABELS[row.category],
    color: EXPENSE_CATEGORY_COLORS[row.category],
    plannedPaise: toWire(row.plannedPaise),
    paidPaise: toWire(row.paidPaise),
    share: row.shareOfPlanned,
    href: `/expenses?month=${monthParam}&category=${row.category}`,
  }));

  /* -------------------------- Receivable lists --------------------------- */

  const start = monthStart(month);
  const scheduleRows: ScheduleListRow[] = forecastableScheduleRollups(index)
    .filter((rollup) => rollup.outstandingPaise > 0n)
    .map((rollup) => {
      const project = index.projectsById.get(rollup.schedule.projectId)!;
      return {
        rollup,
        projectId: project.id,
        projectName: project.name,
        clientName: project.clientName,
      };
    });

  const upcoming = scheduleRows
    .filter((row) => row.rollup.state !== "OVERDUE")
    .sort((a, b) => compareDates(a.rollup.schedule.dueDate, b.rollup.schedule.dueDate));

  const overdue = scheduleRows
    .filter((row) => row.rollup.state === "OVERDUE")
    .sort((a, b) => compareDates(a.rollup.schedule.dueDate, b.rollup.schedule.dueDate));

  const carriedForward = overdue.filter(
    (row) => compareDates(row.rollup.schedule.dueDate, start) < 0,
  );

  const cash = cashPositionAsOf(index, monthEndInclusive(month));
  const loans = loanTotals(index);
  const commissionsPayable = commissionsPayablePaise(index);
  const insights = buildInsights(index, month, summary);
  const pipeline = pipelineTotals(index);

  const isEmptyBook = index.dataset.projects.length === 0 && index.dataset.expenses.length === 0;

  if (isEmptyBook) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Overview"
          description="Nothing has been recorded yet. Add a client and their first project, and this dashboard fills in."
        />
        <EmptyState
          icon={CalendarClock}
          title="Your books are empty"
          description="Start with a client and a project, then record the advance against it. If you would rather look around first, load the labelled demo dataset from Settings."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/clients">Add a client</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/settings#demo">Load demo data</Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description={
          <>
            Cash-based view of <span className="text-foreground">{monthLabel}</span>. Figures marked{" "}
            <span className="text-foreground">Actual</span> are money that has moved; those marked{" "}
            <span className="text-projected">Forecast</span> are still expected.
          </>
        }
      />

      {/* ---------------------- The 30-second answer ---------------------- */}

      <section aria-label="Month result" className="grid gap-3 lg:grid-cols-3">
        <ResultCard
          title="Actual cash surplus / deficit"
          value={summary.actualSurplusPaise}
          marginPercent={summary.surplusMarginPercent}
          caption="Money received less money actually paid out this month. This is a cash view of the business, not accounting net profit — it excludes accruals, depreciation and tax."
          href={`/payments?month=${monthParam}&view=received`}
          rows={[
            {
              label: "Received",
              value: <Money value={summary.actualCollectionsPaise} className="text-[13px]" />,
            },
            {
              label: "Expenses paid",
              value: <Money value={summary.expenseOutflowPaise} className="text-[13px]" />,
            },
            ...(summary.commissionOutflowPaise > 0n
              ? [
                  {
                    label: "Commissions paid",
                    value: (
                      <Money value={summary.commissionOutflowPaise} className="text-[13px]" />
                    ),
                  },
                ]
              : []),
          ]}
        />

        <ResultCard
          title="Projected month-end result"
          kind="forecast"
          value={summary.projectedSurplusPaise}
          caption="Adds payments scheduled for this month from approved projects, and expense budgets still unpaid. Overdue amounts from earlier months are deliberately left out."
          href={`/payments?month=${monthParam}&view=scheduled`}
          rows={[
            {
              label: "Projected collections",
              value: <Money value={summary.projectedCollectionsPaise} className="text-[13px]" />,
            },
            {
              label: "Projected outflow",
              value: <Money value={summary.projectedCashOutflowPaise} className="text-[13px]" />,
            },
          ]}
        />

        <CashBalanceCard position={cash} />
      </section>

      {/* -------------------------- Metric grid --------------------------- */}

      <section aria-label="Key figures" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Money received"
          value={summary.actualCollectionsPaise}
          kind="actual"
          emphasis
          href={`/payments?month=${monthParam}&view=received`}
          delta={
            <DeltaChip percent={comparison?.collectionsDeltaPercent ?? null} suffix={`vs ${previousLabel}`} />
          }
          footnote={`${summary.receiptCount} receipt${summary.receiptCount === 1 ? "" : "s"}`}
        />
        <MetricCard
          label="Expected this month"
          value={summary.expectedAdditionalCollectionsPaise}
          kind="forecast"
          emphasis
          href={`/payments?month=${monthParam}&view=scheduled`}
          footnote="Unpaid schedule, approved projects only"
        />
        <MetricCard
          label="Projected collections"
          value={summary.projectedCollectionsPaise}
          kind="forecast"
          emphasis
          href={`/payments?month=${monthParam}`}
          footnote="Received + still expected"
        />
        <MetricCard
          label="Overdue receivables"
          value={summary.overdueInMonth.amountPaise + summary.overdueCarriedForward.amountPaise}
          kind="actual"
          tone={
            summary.overdueInMonth.amountPaise + summary.overdueCarriedForward.amountPaise > 0n
              ? "negative"
              : "default"
          }
          emphasis
          href={`/payments?month=${monthParam}&view=overdue`}
          footnote={
            summary.overdueCarriedForward.count > 0
              ? `${summary.overdueCarriedForward.count} from earlier months, held out of the forecast`
              : `${summary.overdueInMonth.count} past due`
          }
        />

        <MetricCard
          label="Planned expenses"
          value={summary.plannedExpensesPaise}
          kind="plan"
          href={`/expenses?month=${monthParam}`}
          footnote={`${summary.expenseCount} budget line${summary.expenseCount === 1 ? "" : "s"}`}
        />
        <MetricCard
          label="Expenses paid"
          value={summary.actualCashOutflowPaise}
          kind="actual"
          href={`/expenses?month=${monthParam}&state=paid`}
          delta={
            <DeltaChip
              percent={comparison?.outflowDeltaPercent ?? null}
              invertColours
              suffix={`vs ${previousLabel}`}
            />
          }
        />
        <MetricCard
          label="Still to pay"
          value={summary.outstandingExpensesPaise}
          kind="forecast"
          href={`/expenses?month=${monthParam}&state=unpaid`}
          footnote="Unpaid balance of this month's budget"
        />
        <MetricCard
          label="Projected cash outflow"
          value={summary.projectedCashOutflowPaise}
          kind="forecast"
          href={`/expenses?month=${monthParam}`}
          footnote="Paid + still to pay"
        />
      </section>

      {/* --------------------------- What we owe --------------------------- */}

      {loans.outstandingPaise > 0n || commissionsPayable > 0n || summary.loanDrawnPaise > 0n ? (
        <section aria-label="Obligations" className="space-y-2.5">
          <SectionHeading
            title="What the business owes"
            description="Borrowing and referral commissions. Neither is an operating expense, so neither moves the surplus above — they are shown here so the surplus is never mistaken for money you get to keep."
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Loans outstanding"
              value={loans.outstandingPaise}
              kind="actual"
              tone={loans.outstandingPaise > 0n ? "warning" : "default"}
              href="/loans"
              footnote={`${loans.activeCount} active loan${loans.activeCount === 1 ? "" : "s"}${
                loans.overduePaise > 0n ? " · some past their repay-by date" : ""
              }`}
            />
            <MetricCard
              label="Repaid to date"
              value={loans.repaidPaise}
              kind="actual"
              href="/loans"
              footnote="Across every loan"
            />
            <MetricCard
              label="Commissions payable"
              value={commissionsPayable}
              kind="actual"
              tone={commissionsPayable > 0n ? "warning" : "default"}
              href="/clients?tab=projects"
              footnote="Earned by referrers, not yet paid"
            />
            <MetricCard
              label={`Borrowed in ${formatMonthLabel(month, "compact")}`}
              value={summary.loanDrawnPaise}
              kind="actual"
              href="/loans"
              footnote={
                summary.loanRepaidPaise > 0n ? (
                  <>
                    <Money value={summary.loanRepaidPaise} className="text-[12px]" /> repaid this month
                  </>
                ) : (
                  "Cash in, but not income"
                )
              }
            />
          </div>
        </section>
      ) : null}

      {/* ---------------------------- Insights ---------------------------- */}

      <section aria-label="Insights" className="space-y-2.5">
        <SectionHeading title="What this month is telling you" />
        <InsightsStrip insights={insights} limit={6} />
      </section>

      {/* ----------------------------- Charts ----------------------------- */}

      <section className="grid gap-3 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Collections vs expenses</CardTitle>
            <p className="text-[13px] text-muted-foreground">
              Six months of money actually received and actually paid out.
            </p>
          </CardHeader>
          <CardContent>
            <CollectionsExpensesChart data={series} />
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Expense categories</CardTitle>
            <p className="text-[13px] text-muted-foreground">
              Planned spend for {monthLabel}.
            </p>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <EmptyState
                title="No expenses budgeted"
                description={`Nothing has been planned for ${monthLabel} yet.`}
                compact
              />
            ) : (
              <CategoryBreakdownChart data={categories} />
            )}
          </CardContent>
        </Card>
      </section>

      {/* ----------------------- Receivables & pipeline -------------------- */}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Upcoming payments</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-[12px]">
              <Link href={`/payments?month=${monthParam}&view=scheduled`}>
                All
                <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <ScheduleList
              rows={upcoming}
              today={index.today}
              limit={5}
              emptyTitle="Nothing scheduled"
              emptyDescription="No unpaid milestones are dated ahead on approved projects."
            />
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Overdue
              {overdue.length > 0 ? (
                <span className="rounded-full border border-negative/35 bg-negative-soft px-1.5 py-px font-mono text-[10px] text-negative">
                  {overdue.length}
                </span>
              ) : null}
            </CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-[12px]">
              <Link href={`/payments?month=${monthParam}&view=overdue`}>
                All
                <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {carriedForward.length > 0 ? (
              <p className="mb-2 flex items-start gap-2 rounded-md border border-warning/30 bg-warning-soft px-2.5 py-2 text-[12px] leading-relaxed text-warning">
                <TriangleAlert className="mt-px size-3.5 shrink-0" />
                <span>
                  {carriedForward.length} of these fell due before {monthLabel}. They stay out of the
                  forecast until you reschedule them.
                </span>
              </p>
            ) : null}
            <ScheduleList
              rows={overdue}
              today={index.today}
              limit={5}
              emptyTitle="Nothing overdue"
              emptyDescription="Every scheduled payment on approved projects is within its due date."
            />
          </CardContent>
        </Card>

        <Card className="md:col-span-2 xl:col-span-1">
          <CardHeader>
            <CardTitle>Project pipeline</CardTitle>
            <p className="text-[13px] text-muted-foreground">Contract value by status.</p>
          </CardHeader>
          <CardContent>
            <PipelineCard totals={pipeline} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
