/**
 * Deterministic commentary.
 *
 * Every sentence here is derived from stored figures by a fixed rule — there
 * is no model call and no invented narrative. Given the same data, the same
 * insights come out, in the same order.
 */

import { formatINR, formatPercent, type Paise } from "@/lib/money";
import { formatMonthLabel, type MonthKey } from "@/lib/dates";
import { EXPENSE_CATEGORY_LABELS } from "./labels";
import {
  clientTotals,
  expenseCategoryBreakdown,
  forecastableScheduleRollups,
  potentialPipelinePaise,
  type FinanceIndex,
} from "./engine";
import type { Insight, MonthSummary } from "./types";

const ONES = ["zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

/** "Three client payments" reads better than "3 client payments". */
function spell(count: number): string {
  return count < ONES.length ? ONES[count] : String(count);
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm;
}

export function buildInsights(
  index: FinanceIndex,
  month: MonthKey,
  summary: MonthSummary,
): Insight[] {
  const insights: Insight[] = [];
  const monthLabel = formatMonthLabel(month, "long");
  const monthParam = `${month.year}-${String(month.month).padStart(2, "0")}`;

  /* Overdue money first — it is the only thing that needs a person to act. */

  if (summary.overdueCarriedForward.count > 0) {
    insights.push({
      id: "overdue-carried",
      tone: "negative",
      text:
        `${formatINR(summary.overdueCarriedForward.amountPaise)} across ` +
        `${spell(summary.overdueCarriedForward.count).toLowerCase()} ` +
        `${plural(summary.overdueCarriedForward.count, "payment")} has been overdue since before ` +
        `${monthLabel}, and is excluded from this month's forecast until rescheduled.`,
      href: `/payments?view=overdue&month=${monthParam}`,
    });
  }

  if (summary.overdueInMonth.count > 0) {
    insights.push({
      id: "overdue-in-month",
      tone: "warning",
      text:
        `${spell(summary.overdueInMonth.count)} client ` +
        `${plural(summary.overdueInMonth.count, "payment")} ` +
        `${summary.overdueInMonth.count === 1 ? "is" : "are"} overdue, worth ` +
        `${formatINR(summary.overdueInMonth.amountPaise)}.`,
      href: `/payments?view=overdue&month=${monthParam}`,
    });
  }

  /* What is still expected to arrive. */

  if (summary.expectedAdditionalCollectionsPaise > 0n) {
    insights.push({
      id: "expected-collections",
      tone: "neutral",
      text: `${formatINR(summary.expectedAdditionalCollectionsPaise)} remains scheduled for collection this month.`,
      href: `/payments?view=scheduled&month=${monthParam}`,
    });
  } else if (summary.actualCollectionsPaise > 0n) {
    insights.push({
      id: "collections-complete",
      tone: "positive",
      text: `Every payment scheduled for ${monthLabel} has been collected.`,
      href: `/payments?month=${monthParam}`,
    });
  }

  /* Where the money is going. */

  const categories = expenseCategoryBreakdown(index, month);
  const largest = categories[0];
  if (largest && largest.shareOfPlanned !== null && summary.plannedExpensesPaise > 0n) {
    insights.push({
      id: "largest-category",
      tone: "neutral",
      text:
        `${EXPENSE_CATEGORY_LABELS[largest.category]} represent ` +
        `${formatPercent(largest.shareOfPlanned)} of this month's planned expenditure ` +
        `(${formatINR(largest.plannedPaise)}).`,
      href: `/expenses?month=${monthParam}&category=${largest.category}`,
    });
  }

  if (summary.outstandingExpensesPaise > 0n) {
    insights.push({
      id: "expenses-unpaid",
      tone: "neutral",
      text: `${formatINR(summary.outstandingExpensesPaise)} of the ${monthLabel} expense budget is still unpaid.`,
      href: `/expenses?month=${monthParam}&state=unpaid`,
    });
  }

  /* Where the month lands. */

  if (!summary.isEmpty) {
    const projected = summary.projectedSurplusPaise;
    insights.push({
      id: "projected-result",
      tone: projected >= 0n ? "positive" : "negative",
      text:
        projected >= 0n
          ? `On current schedules ${monthLabel} closes at a projected cash surplus of ${formatINR(projected)}.`
          : `On current schedules ${monthLabel} closes at a projected cash deficit of ${formatINR(-projected)}.`,
    });
  }

  /* Hygiene: money recorded but not matched, and contract value with no date. */

  const unallocated = sumUnallocatedReceipts(index);
  if (unallocated > 0n) {
    insights.push({
      id: "unallocated-receipts",
      tone: "warning",
      text: `${formatINR(unallocated)} received is not yet matched to a scheduled payment.`,
      href: "/payments?view=unallocated",
    });
  }

  const unscheduled = sumUnscheduledApproved(index);
  if (unscheduled > 0n) {
    insights.push({
      id: "unscheduled-balance",
      tone: "neutral",
      text:
        `${formatINR(unscheduled)} of approved contract value has no collection date yet, ` +
        `so it is not counted in any monthly forecast.`,
      href: "/projects?filter=unscheduled",
    });
  }

  const pipeline = potentialPipelinePaise(index);
  if (pipeline > 0n) {
    insights.push({
      id: "pipeline",
      tone: "neutral",
      text: `${formatINR(pipeline)} sits in pending and on-hold work, held out of the forecast.`,
      href: "/projects?status=PENDING",
    });
  }

  /* Concentration risk — only worth saying when it is genuinely lopsided. */

  const clients = clientTotals(index);
  const totalCollected = clients.reduce((total, row) => total + row.collectedPaise, 0n);
  if (clients.length > 1 && totalCollected > 0n) {
    const top = clients[0];
    const share = Number((top.collectedPaise * 1000n) / totalCollected) / 10;
    if (share >= 50) {
      insights.push({
        id: "client-concentration",
        tone: "warning",
        text: `${top.clientName} accounts for ${formatPercent(share)} of all money collected to date.`,
        href: `/clients/${top.clientId}`,
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      id: "empty",
      tone: "neutral",
      text: `No projects, payments or expenses have been recorded for ${monthLabel} yet.`,
    });
  }

  return insights;
}

function sumUnallocatedReceipts(index: FinanceIndex): Paise {
  let total = 0n;
  for (const rollup of index.receiptRollups.values()) total += rollup.unallocatedPaise;
  return total;
}

function sumUnscheduledApproved(index: FinanceIndex): Paise {
  let total = 0n;
  for (const rollup of index.projectRollups.values()) {
    if (rollup.isForecastable) total += rollup.unscheduledPaise;
  }
  return total;
}

/** Count of live schedule lines still owed — used by the header badge. */
export function openReceivableCount(index: FinanceIndex): number {
  return forecastableScheduleRollups(index).filter((rollup) => rollup.outstandingPaise > 0n).length;
}
