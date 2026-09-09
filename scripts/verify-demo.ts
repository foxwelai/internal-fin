/**
 * Cross-checks the engine's month summary against whatever is in the database.
 * It goes through the same repository loader the app uses, so it can never
 * drift from what the dashboard shows.
 */
import "dotenv/config";

import { indexDataset } from "../src/lib/finance/engine";
import {
  cashPositionAsOf,
  expenseCategoryBreakdown,
  potentialPipelinePaise,
  summariseMonth,
} from "../src/lib/finance/engine";
import { fetchFinanceDataset } from "../src/lib/finance/repository";
import { buildInsights } from "../src/lib/finance/insights";
import { currentMonthKey, formatMonthLabel, monthEndInclusive } from "../src/lib/dates";
import { formatINR, formatPercent } from "../src/lib/money";
import { prisma } from "../src/lib/db";

async function main() {
  const index = indexDataset(await fetchFinanceDataset());
  const month = currentMonthKey();
  const summary = summariseMonth(index, month);

  const row = (label: string, value: bigint) =>
    console.log(`  ${label.padEnd(34)} ${formatINR(value).padStart(16)}`);

  console.log(`\n=== ${formatMonthLabel(month, "long")} ===`);
  row("Money received", summary.actualCollectionsPaise);
  row("Expected additional", summary.expectedAdditionalCollectionsPaise);
  row("Projected collections", summary.projectedCollectionsPaise);
  row("Planned expenses", summary.plannedExpensesPaise);
  row("Actual cash outflow", summary.actualCashOutflowPaise);
  row("Outstanding expenses", summary.outstandingExpensesPaise);
  row("Projected cash outflow", summary.projectedCashOutflowPaise);
  row("ACTUAL surplus/deficit", summary.actualSurplusPaise);
  row("PROJECTED surplus/deficit", summary.projectedSurplusPaise);
  console.log(
    `  ${"Cash surplus margin".padEnd(34)} ${formatPercent(summary.surplusMarginPercent).padStart(16)}`,
  );
  row(`Overdue in month (${summary.overdueInMonth.count})`, summary.overdueInMonth.amountPaise);
  row(
    `Overdue carried forward (${summary.overdueCarriedForward.count})`,
    summary.overdueCarriedForward.amountPaise,
  );
  row("Potential pipeline", potentialPipelinePaise(index));

  const cash = cashPositionAsOf(index, monthEndInclusive(month));
  if (cash) {
    console.log("\n  Cash position at month end");
    row("  opening", cash.openingBalancePaise);
    row("  operating in", cash.operatingInflowPaise);
    row("  operating out", cash.operatingOutflowPaise);
    row("  non-operating net", cash.nonOperatingNetPaise);
    row("  closing", cash.closingBalancePaise);
  }

  console.log("\n  Expense categories");
  for (const category of expenseCategoryBreakdown(index, month)) {
    console.log(
      `    ${category.category.padEnd(14)} ${formatINR(category.plannedPaise).padStart(12)}  ` +
        `${formatPercent(category.shareOfPlanned).padStart(7)}  paid ${formatINR(category.paidPaise)}`,
    );
  }

  console.log("\n  Project integrity (received + scheduled + unscheduled === budget)");
  let failures = 0;
  for (const rollup of index.projectRollups.values()) {
    const total =
      rollup.receivedPaise + rollup.scheduledOutstandingPaise + rollup.unscheduledPaise;
    const ok = total === rollup.budgetPaise;
    if (!ok) failures += 1;
    console.log(
      `    ${ok ? "ok  " : "FAIL"} ${rollup.project.name.padEnd(30)} ` +
        `budget ${formatINR(rollup.budgetPaise).padStart(13)}  ` +
        `recv ${formatINR(rollup.receivedPaise).padStart(13)}  ` +
        `sched ${formatINR(rollup.scheduledOutstandingPaise).padStart(13)}  ` +
        `unsched ${formatINR(rollup.unscheduledPaise).padStart(11)}`,
    );
  }
  console.log(
    `\n  ${failures === 0 ? "All projects reconcile." : `${failures} project(s) do not reconcile.`}`,
  );

  console.log("\n  Insights");
  for (const insight of buildInsights(index, month, summary)) {
    console.log(`    [${insight.tone}] ${insight.text}`);
  }
  console.log();

  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
