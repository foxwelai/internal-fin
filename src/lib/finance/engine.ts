/**
 * The financial engine.
 *
 * Every figure the application shows — cards, charts, tables, CSV exports —
 * comes from this file, so a number can never disagree with itself across two
 * screens. It is deliberately free of Prisma, React and I/O: it takes a plain
 * dataset and returns plain results, which is what makes the rules in
 * engine.test.ts able to pin the behaviour down exactly.
 *
 * The two ideas the whole model rests on:
 *
 *  1. Expected money and received money are different things. A schedule line
 *     is an expectation; a receipt is cash. Only receipts are ever "collected".
 *  2. An advance is part of the project budget, not extra revenue. So a
 *     project's remaining balance is always budget − receipts, and scheduling
 *     is a separate breakdown of that same balance.
 */

import {
  clampToZero,
  minPaise,
  percentOf,
  sumBy,
  type Paise,
} from "@/lib/money";
import {
  compareDates,
  daysBetween,
  isInMonth,
  monthStart,
  type MonthKey,
} from "@/lib/dates";
import {
  FORECASTABLE_STATUSES,
  PIPELINE_STATUSES,
  PROJECT_STATUSES,
  type AgeingRow,
  type CashMovementType,
  type CashPosition,
  type CategoryBreakdownRow,
  type ClientTotalsRow,
  type EngineExpense,
  type EngineLoan,
  type EngineProject,
  type EngineSchedule,
  type ExpenseCategory,
  type ExpenseRollup,
  type FinanceDataset,
  type LoanRollup,
  type LoanTotals,
  type MonthComparison,
  type MonthSummary,
  type OverdueBucket,
  type PipelineTotals,
  type ProjectRollup,
  type ReceiptRollup,
  type ScheduleRollup,
  type ScheduleState,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Index                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A dataset with the cross-references resolved once. Every other function in
 * this module reads from the index rather than re-scanning arrays, so a page
 * that renders eight cards and four charts still walks the data once.
 */
export type FinanceIndex = ReturnType<typeof indexDataset>;

export function indexDataset(dataset: FinanceDataset) {
  const { today } = dataset;

  const allocatedByScheduleId = new Map<string, Paise>();
  const allocatedByReceiptId = new Map<string, Paise>();
  for (const allocation of dataset.allocations) {
    allocatedByScheduleId.set(
      allocation.scheduleId,
      (allocatedByScheduleId.get(allocation.scheduleId) ?? 0n) + allocation.amountPaise,
    );
    allocatedByReceiptId.set(
      allocation.receiptId,
      (allocatedByReceiptId.get(allocation.receiptId) ?? 0n) + allocation.amountPaise,
    );
  }

  const commissionPaidByProjectId = new Map<string, Paise>();
  for (const payment of dataset.commissionPayments) {
    commissionPaidByProjectId.set(
      payment.projectId,
      (commissionPaidByProjectId.get(payment.projectId) ?? 0n) + payment.amountPaise,
    );
  }

  const loanRepaidByLoanId = new Map<string, Paise>();
  for (const payment of dataset.loanPayments) {
    loanRepaidByLoanId.set(
      payment.loanId,
      (loanRepaidByLoanId.get(payment.loanId) ?? 0n) + payment.amountPaise,
    );
  }

  const loanRollups = new Map<string, LoanRollup>();
  for (const loan of dataset.loans) {
    loanRollups.set(loan.id, rollUpLoan(loan, loanRepaidByLoanId.get(loan.id) ?? 0n, today));
  }

  const paidByExpenseId = new Map<string, Paise>();
  for (const payment of dataset.expensePayments) {
    paidByExpenseId.set(
      payment.expenseId,
      (paidByExpenseId.get(payment.expenseId) ?? 0n) + payment.amountPaise,
    );
  }

  const projectsById = new Map(dataset.projects.map((project) => [project.id, project]));

  const schedulesByProjectId = groupBy(
    dataset.schedules.filter((schedule) => schedule.archivedAt === null),
    (schedule) => schedule.projectId,
  );
  const receiptsByProjectId = groupBy(dataset.receipts, (receipt) => receipt.projectId);
  const expensesByPeriod = groupBy(
    dataset.expenses.filter((expense) => expense.archivedAt === null),
    (expense) => periodKey(expense.periodYear, expense.periodMonth),
  );

  const scheduleRollups = new Map<string, ScheduleRollup>();
  for (const schedule of dataset.schedules) {
    scheduleRollups.set(schedule.id, rollUpSchedule(schedule, allocatedByScheduleId.get(schedule.id) ?? 0n, today));
  }

  const receiptRollups = new Map<string, ReceiptRollup>();
  for (const receipt of dataset.receipts) {
    const allocatedPaise = allocatedByReceiptId.get(receipt.id) ?? 0n;
    receiptRollups.set(receipt.id, {
      receipt,
      allocatedPaise,
      unallocatedPaise: clampToZero(receipt.amountPaise - allocatedPaise),
    });
  }

  const expenseRollups = new Map<string, ExpenseRollup>();
  for (const expense of dataset.expenses) {
    expenseRollups.set(expense.id, rollUpExpense(expense, paidByExpenseId.get(expense.id) ?? 0n, today));
  }

  const projectRollups = new Map<string, ProjectRollup>();
  for (const project of dataset.projects) {
    projectRollups.set(
      project.id,
      rollUpProject(
        project,
        schedulesByProjectId.get(project.id) ?? [],
        receiptsByProjectId.get(project.id) ?? [],
        scheduleRollups,
        receiptRollups,
        commissionPaidByProjectId.get(project.id) ?? 0n,
      ),
    );
  }

  return {
    dataset,
    today,
    projectsById,
    projectRollups,
    scheduleRollups,
    receiptRollups,
    expenseRollups,
    loanRollups,
    schedulesByProjectId,
    receiptsByProjectId,
    expensesByPeriod,
  };
}

function periodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/* -------------------------------------------------------------------------- */
/* Row-level rollups                                                           */
/* -------------------------------------------------------------------------- */

export function rollUpSchedule(schedule: EngineSchedule, allocatedPaise: Paise, today: Date): ScheduleRollup {
  const outstandingPaise = clampToZero(schedule.amountPaise - allocatedPaise);
  const daysOverdue = outstandingPaise > 0n ? Math.max(0, daysBetween(schedule.dueDate, today)) : 0;

  let state: ScheduleState;
  if (outstandingPaise === 0n) state = "PAID";
  else if (daysOverdue > 0) state = "OVERDUE";
  else if (allocatedPaise > 0n) state = "PARTIALLY_PAID";
  else state = "UNPAID";

  return { schedule, allocatedPaise, outstandingPaise, state, daysOverdue };
}

export function rollUpLoan(loan: EngineLoan, repaidPaise: Paise, today: Date): LoanRollup {
  const outstandingPaise = clampToZero(loan.principalPaise - repaidPaise);
  return {
    loan,
    repaidPaise,
    outstandingPaise,
    paymentCount: 0,
    isOverdue:
      outstandingPaise > 0n &&
      loan.dueDate !== null &&
      compareDates(loan.dueDate, today) < 0 &&
      loan.status === "ACTIVE",
  };
}

/**
 * What the referrer has earned.
 *
 * A percentage is applied to money *actually received*, never to the contract
 * value, so nothing is owed on an invoice the client has not paid. Basis points
 * keep it in integer arithmetic: 12.5% is 1250, and the divide by 10,000 is the
 * last operation, so at most one paisa is lost to truncation.
 */
export function commissionDueOn(project: EngineProject, receivedPaise: Paise): Paise {
  if (project.commissionBasis === "FIXED") {
    return project.commissionAmountPaise ?? 0n;
  }
  if (project.commissionBasis === "PERCENT_OF_RECEIVED") {
    const bps = BigInt(project.commissionRateBps ?? 0);
    return (receivedPaise * bps) / 10_000n;
  }
  return 0n;
}

/** A recurring price restated as a yearly figure, for like-for-like comparison. */
export function annualiseRecurring(project: EngineProject): Paise {
  const amount = project.recurringAmountPaise;
  if (project.billingType !== "SUBSCRIPTION" || !amount || !project.recurringInterval) return 0n;
  switch (project.recurringInterval) {
    case "MONTHLY":
      return amount * 12n;
    case "QUARTERLY":
      return amount * 4n;
    case "YEARLY":
      return amount;
  }
}

export function rollUpExpense(expense: EngineExpense, paidPaise: Paise, today: Date): ExpenseRollup {
  const outstandingPaise = clampToZero(expense.plannedPaise - paidPaise);
  const daysOverdue =
    outstandingPaise > 0n && expense.dueDate ? Math.max(0, daysBetween(expense.dueDate, today)) : 0;

  let state: ExpenseRollup["state"];
  if (outstandingPaise === 0n) state = "PAID";
  else if (daysOverdue > 0) state = "OVERDUE";
  else if (paidPaise > 0n) state = "PARTIALLY_PAID";
  else state = "UNPAID";

  return { expense, paidPaise, outstandingPaise, state, daysOverdue };
}

function rollUpProject(
  project: ProjectRollup["project"],
  schedules: readonly EngineSchedule[],
  receipts: readonly { id: string; amountPaise: Paise }[],
  scheduleRollups: Map<string, ScheduleRollup>,
  receiptRollups: Map<string, ReceiptRollup>,
  commissionPaidPaise: Paise,
): ProjectRollup {
  const receivedPaise = sumBy(receipts, (receipt) => receipt.amountPaise);

  // Budget less cash in. An advance therefore consumes budget rather than
  // adding to it, which is what stops advances being double counted.
  const remainingBalancePaise = clampToZero(project.budgetPaise - receivedPaise);

  const rollups = schedules
    .map((schedule) => scheduleRollups.get(schedule.id))
    .filter((rollup): rollup is ScheduleRollup => rollup !== undefined);

  const scheduledOutstandingPaise = sumBy(rollups, (rollup) => rollup.outstandingPaise);
  const overduePaise = sumBy(
    rollups.filter((rollup) => rollup.state === "OVERDUE"),
    (rollup) => rollup.outstandingPaise,
  );

  // What is left of the contract that nobody has put a date against yet.
  const unscheduledPaise = clampToZero(remainingBalancePaise - scheduledOutstandingPaise);

  const unallocatedReceiptsPaise = sumBy(
    receipts
      .map((receipt) => receiptRollups.get(receipt.id))
      .filter((rollup): rollup is ReceiptRollup => rollup !== undefined),
    (rollup) => rollup.unallocatedPaise,
  );

  const upcoming = rollups
    .filter((rollup) => rollup.outstandingPaise > 0n)
    .sort((a, b) => compareDates(a.schedule.dueDate, b.schedule.dueDate))[0];

  return {
    project,
    budgetPaise: project.budgetPaise,
    receivedPaise,
    remainingBalancePaise,
    scheduledOutstandingPaise,
    unscheduledPaise,
    unallocatedReceiptsPaise,
    overduePaise,
    nextPaymentDate: upcoming?.schedule.dueDate ?? null,
    nextPaymentPaise: upcoming?.outstandingPaise ?? 0n,
    scheduleCount: rollups.length,
    receiptCount: receipts.length,
    isForecastable: isForecastable(project),

    commissionDuePaise: commissionDueOn(project, receivedPaise),
    commissionPaidPaise,
    commissionOutstandingPaise: clampToZero(
      commissionDueOn(project, receivedPaise) - commissionPaidPaise,
    ),
    annualisedRecurringPaise: annualiseRecurring(project),
  };
}

/* -------------------------------------------------------------------------- */
/* Loans                                                                       */
/* -------------------------------------------------------------------------- */

export function loanTotals(index: FinanceIndex): LoanTotals {
  const rollups = [...index.loanRollups.values()];
  const active = rollups.filter((rollup) => rollup.loan.status === "ACTIVE");
  return {
    activeCount: active.length,
    principalPaise: sumBy(active, (rollup) => rollup.loan.principalPaise),
    repaidPaise: sumBy(rollups, (rollup) => rollup.repaidPaise),
    outstandingPaise: sumBy(active, (rollup) => rollup.outstandingPaise),
    overduePaise: sumBy(
      active.filter((rollup) => rollup.isOverdue),
      (rollup) => rollup.outstandingPaise,
    ),
  };
}

/** Referral commission owed across every live project. */
export function commissionsPayablePaise(index: FinanceIndex): Paise {
  return sumBy(
    [...index.projectRollups.values()].filter((rollup) => rollup.project.archivedAt === null),
    (rollup) => rollup.commissionOutstandingPaise,
  );
}

export function isForecastable(project: {
  status: ProjectRollup["project"]["status"];
  archivedAt: Date | null;
}): boolean {
  return project.archivedAt === null && FORECASTABLE_STATUSES.includes(project.status);
}

/* -------------------------------------------------------------------------- */
/* Month summary — the numbers behind the Overview cards                       */
/* -------------------------------------------------------------------------- */

export function summariseMonth(index: FinanceIndex, month: MonthKey): MonthSummary {
  const { dataset } = index;
  const start = monthStart(month);

  /* --- Collections ------------------------------------------------------- */

  // Actual receipts dated inside the month, whatever the project's status.
  // Cash that arrived is cash that arrived.
  const receiptsInMonth = dataset.receipts.filter((receipt) => isInMonth(receipt.receivedOn, month));
  const actualCollectionsPaise = sumBy(receiptsInMonth, (receipt) => receipt.amountPaise);

  // Expectations: only approved, live projects, only the unpaid portion, only
  // schedule lines actually due inside this month.
  const forecastSchedules = forecastableScheduleRollups(index);
  const dueInMonth = forecastSchedules.filter((rollup) => isInMonth(rollup.schedule.dueDate, month));
  const expectedAdditionalCollectionsPaise = sumBy(dueInMonth, (rollup) => rollup.outstandingPaise);

  /* --- Overdue ----------------------------------------------------------- */

  const overdueInMonth = bucketOf(dueInMonth.filter((rollup) => rollup.state === "OVERDUE"));
  const overdueCarriedForward = bucketOf(
    forecastSchedules.filter(
      (rollup) => rollup.state === "OVERDUE" && compareDates(rollup.schedule.dueDate, start) < 0,
    ),
  );

  /* --- Expenses ---------------------------------------------------------- */

  const expensesForMonth = dataset.expenses.filter(
    (expense) =>
      expense.archivedAt === null &&
      expense.periodYear === month.year &&
      expense.periodMonth === month.month,
  );
  const plannedExpensesPaise = sumBy(expensesForMonth, (expense) => expense.plannedPaise);

  // Cash out is dated by when it was paid, not by which month it was budgeted
  // to — a September payment for an August bill hits September's cash.
  const paymentsInMonth = dataset.expensePayments.filter((payment) => isInMonth(payment.paidOn, month));
  const expenseOutflowPaise = sumBy(paymentsInMonth, (payment) => payment.amountPaise);

  // Referral commissions are a genuine operating cost, but they sit outside the
  // expense budget, so they are counted separately and then added in.
  const commissionsInMonth = dataset.commissionPayments.filter((payment) =>
    isInMonth(payment.paidOn, month),
  );
  const commissionOutflowPaise = sumBy(commissionsInMonth, (payment) => payment.amountPaise);
  const actualCashOutflowPaise = expenseOutflowPaise + commissionOutflowPaise;

  // Financing. Neither figure touches the operating result — they move only the
  // cash balance.
  const loanDrawnPaise = sumBy(
    dataset.loans.filter((loan) => isInMonth(loan.receivedOn, month)),
    (loan) => loan.principalPaise,
  );
  const loanRepaidPaise = sumBy(
    dataset.loanPayments.filter((payment) => isInMonth(payment.paidOn, month)),
    (payment) => payment.amountPaise,
  );

  const outstandingExpensesPaise = sumBy(
    expensesForMonth
      .map((expense) => index.expenseRollups.get(expense.id))
      .filter((rollup): rollup is ExpenseRollup => rollup !== undefined),
    (rollup) => rollup.outstandingPaise,
  );

  /* --- Results ----------------------------------------------------------- */

  const projectedCollectionsPaise = actualCollectionsPaise + expectedAdditionalCollectionsPaise;
  const projectedCashOutflowPaise = actualCashOutflowPaise + outstandingExpensesPaise;
  const actualSurplusPaise = actualCollectionsPaise - actualCashOutflowPaise;
  const projectedSurplusPaise = projectedCollectionsPaise - projectedCashOutflowPaise;

  return {
    month,
    actualCollectionsPaise,
    expectedAdditionalCollectionsPaise,
    projectedCollectionsPaise,
    plannedExpensesPaise,
    expenseOutflowPaise,
    commissionOutflowPaise,
    actualCashOutflowPaise,
    outstandingExpensesPaise,
    projectedCashOutflowPaise,
    loanDrawnPaise,
    loanRepaidPaise,
    actualSurplusPaise,
    projectedSurplusPaise,
    // Zero collections yields null, which every caller renders as "—".
    surplusMarginPercent: percentOf(actualSurplusPaise, actualCollectionsPaise),
    overdueInMonth,
    overdueCarriedForward,
    receiptCount: receiptsInMonth.length,
    expenseCount: expensesForMonth.length,
    isEmpty:
      receiptsInMonth.length === 0 &&
      expensesForMonth.length === 0 &&
      paymentsInMonth.length === 0 &&
      commissionsInMonth.length === 0 &&
      loanDrawnPaise === 0n &&
      loanRepaidPaise === 0n,
  };
}

function bucketOf(rollups: readonly ScheduleRollup[]): OverdueBucket {
  return {
    amountPaise: sumBy(rollups, (rollup) => rollup.outstandingPaise),
    count: rollups.length,
  };
}

/** Schedule rollups belonging to approved, unarchived projects. */
export function forecastableScheduleRollups(index: FinanceIndex): ScheduleRollup[] {
  const result: ScheduleRollup[] = [];
  for (const rollup of index.scheduleRollups.values()) {
    if (rollup.schedule.archivedAt !== null) continue;
    const project = index.projectsById.get(rollup.schedule.projectId);
    if (!project || !isForecastable(project)) continue;
    result.push(rollup);
  }
  return result;
}

/**
 * Month-over-month deltas. Returns null when the previous month holds no data
 * at all, so the UI shows a neutral empty state rather than a fake "+100%".
 */
export function compareToPreviousMonth(
  index: FinanceIndex,
  current: MonthSummary,
  previousMonth: MonthKey,
): MonthComparison {
  const previous = summariseMonth(index, previousMonth);
  if (previous.isEmpty) return null;

  return {
    collectionsDeltaPercent: deltaPercent(previous.actualCollectionsPaise, current.actualCollectionsPaise),
    outflowDeltaPercent: deltaPercent(previous.actualCashOutflowPaise, current.actualCashOutflowPaise),
    surplusDeltaPaise: current.actualSurplusPaise - previous.actualSurplusPaise,
    previous,
  };
}

function deltaPercent(from: Paise, to: Paise): number | null {
  if (from === 0n) return null;
  const magnitude = from < 0n ? -from : from;
  const scaled = ((to - from) * 1000n) / magnitude;
  return Number(scaled) / 10;
}

/* -------------------------------------------------------------------------- */
/* Breakdowns                                                                  */
/* -------------------------------------------------------------------------- */

export function expenseCategoryBreakdown(index: FinanceIndex, month: MonthKey): CategoryBreakdownRow[] {
  const rows = new Map<ExpenseCategory, { plannedPaise: Paise; paidPaise: Paise }>();

  for (const expense of index.dataset.expenses) {
    if (expense.archivedAt !== null) continue;
    if (expense.periodYear !== month.year || expense.periodMonth !== month.month) continue;
    const rollup = index.expenseRollups.get(expense.id);
    const current = rows.get(expense.category) ?? { plannedPaise: 0n, paidPaise: 0n };
    current.plannedPaise += expense.plannedPaise;
    current.paidPaise += rollup?.paidPaise ?? 0n;
    rows.set(expense.category, current);
  }

  const totalPlanned = sumBy([...rows.values()], (row) => row.plannedPaise);

  return [...rows.entries()]
    .map(([category, row]) => ({
      category,
      plannedPaise: row.plannedPaise,
      paidPaise: row.paidPaise,
      shareOfPlanned: percentOf(row.plannedPaise, totalPlanned),
    }))
    .sort((a, b) => (b.plannedPaise > a.plannedPaise ? 1 : b.plannedPaise < a.plannedPaise ? -1 : 0));
}

export function pipelineTotals(index: FinanceIndex): PipelineTotals[] {
  return PROJECT_STATUSES.map((status) => {
    const rollups = [...index.projectRollups.values()].filter(
      (rollup) => rollup.project.status === status && rollup.project.archivedAt === null,
    );
    return {
      status,
      projectCount: rollups.length,
      budgetPaise: sumBy(rollups, (rollup) => rollup.budgetPaise),
      receivedPaise: sumBy(rollups, (rollup) => rollup.receivedPaise),
      remainingPaise: sumBy(rollups, (rollup) => rollup.remainingBalancePaise),
    };
  });
}

/** Potential value sitting in Pending / On Hold work — never in the forecast. */
export function potentialPipelinePaise(index: FinanceIndex): Paise {
  return sumBy(
    [...index.projectRollups.values()].filter(
      (rollup) =>
        rollup.project.archivedAt === null && PIPELINE_STATUSES.includes(rollup.project.status),
    ),
    (rollup) => rollup.remainingBalancePaise,
  );
}

export function clientTotals(index: FinanceIndex): ClientTotalsRow[] {
  const rows = new Map<string, ClientTotalsRow>();

  for (const rollup of index.projectRollups.values()) {
    if (rollup.project.archivedAt !== null) continue;
    const existing =
      rows.get(rollup.project.clientId) ??
      {
        clientId: rollup.project.clientId,
        clientName: rollup.project.clientName,
        collectedPaise: 0n,
        outstandingPaise: 0n,
        overduePaise: 0n,
        projectCount: 0,
      };
    existing.collectedPaise += rollup.receivedPaise;
    existing.projectCount += 1;
    if (rollup.isForecastable) {
      existing.outstandingPaise += rollup.scheduledOutstandingPaise;
      existing.overduePaise += rollup.overduePaise;
    }
    rows.set(rollup.project.clientId, existing);
  }

  return [...rows.values()].sort((a, b) =>
    b.collectedPaise > a.collectedPaise ? 1 : b.collectedPaise < a.collectedPaise ? -1 : 0,
  );
}

const AGEING_BUCKETS: { key: AgeingRow["bucket"]; label: string; min: number; max: number }[] = [
  { key: "current", label: "Not yet due", min: Number.NEGATIVE_INFINITY, max: 0 },
  { key: "1-30", label: "1–30 days", min: 1, max: 30 },
  { key: "31-60", label: "31–60 days", min: 31, max: 60 },
  { key: "61-90", label: "61–90 days", min: 61, max: 90 },
  { key: "90+", label: "Over 90 days", min: 91, max: Number.POSITIVE_INFINITY },
];

export function receivablesAgeing(index: FinanceIndex): AgeingRow[] {
  const rows = AGEING_BUCKETS.map((bucket) => ({
    bucket: bucket.key,
    label: bucket.label,
    amountPaise: 0n as Paise,
    count: 0,
  }));

  for (const rollup of forecastableScheduleRollups(index)) {
    if (rollup.outstandingPaise === 0n) continue;
    const age = rollup.daysOverdue;
    const bucketIndex = AGEING_BUCKETS.findIndex((bucket) => age >= bucket.min && age <= bucket.max);
    const target = rows[bucketIndex === -1 ? 0 : bucketIndex];
    target.amountPaise += rollup.outstandingPaise;
    target.count += 1;
  }

  return rows;
}

/* -------------------------------------------------------------------------- */
/* Cash position                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Bank-style running balance. Funding, owner contributions and withdrawals are
 * tracked here and nowhere else, so they move the cash balance without ever
 * touching collections, expenses or the surplus.
 */
export function cashPositionAsOf(index: FinanceIndex, asOf: Date): CashPosition | null {
  const opening = index.dataset.openingBalance;
  if (!opening) return null;

  const inWindow = (date: Date) =>
    compareDates(date, opening.effectiveDate) >= 0 && compareDates(date, asOf) <= 0;

  const operatingInflowPaise = sumBy(
    index.dataset.receipts.filter((receipt) => inWindow(receipt.receivedOn)),
    (receipt) => receipt.amountPaise,
  );
  const operatingOutflowPaise =
    sumBy(
      index.dataset.expensePayments.filter((payment) => inWindow(payment.paidOn)),
      (payment) => payment.amountPaise,
    ) +
    sumBy(
      index.dataset.commissionPayments.filter((payment) => inWindow(payment.paidOn)),
      (payment) => payment.amountPaise,
    );

  // Borrowing moves cash without being income or cost: principal in, repayments
  // out, reported on its own line so it can never flatter the operating result.
  const financingNetPaise =
    sumBy(
      index.dataset.loans.filter((loan) => inWindow(loan.receivedOn)),
      (loan) => loan.principalPaise,
    ) -
    sumBy(
      index.dataset.loanPayments.filter((payment) => inWindow(payment.paidOn)),
      (payment) => payment.amountPaise,
    );

  let nonOperatingNetPaise = 0n;
  for (const movement of index.dataset.cashMovements) {
    if (!inWindow(movement.occurredOn)) continue;
    nonOperatingNetPaise += signedCashMovement(movement.type, movement.amountPaise);
  }

  return {
    openingBalancePaise: opening.amountPaise,
    effectiveDate: opening.effectiveDate,
    operatingInflowPaise,
    operatingOutflowPaise,
    financingNetPaise,
    nonOperatingNetPaise,
    closingBalancePaise:
      opening.amountPaise +
      operatingInflowPaise -
      operatingOutflowPaise +
      financingNetPaise +
      nonOperatingNetPaise,
    asOf,
  };
}

export function signedCashMovement(type: CashMovementType, amount: Paise): Paise {
  switch (type) {
    case "OWNER_WITHDRAWAL":
    case "TRANSFER_OUT":
      return -amount;
    default:
      return amount;
  }
}

/* -------------------------------------------------------------------------- */
/* Validation helpers — shared by every server action                          */
/* -------------------------------------------------------------------------- */

export type ValidationFailure = { ok: false; message: string };
export type ValidationSuccess = { ok: true };
export type ValidationResult = ValidationSuccess | ValidationFailure;

const ok: ValidationSuccess = { ok: true };

/**
 * Keeps total receipts within the agreed budget. Version one refuses the write
 * rather than silently recording revenue the contract does not cover.
 */
export function checkReceiptWithinBudget(input: {
  budgetPaise: Paise;
  alreadyReceivedPaise: Paise;
  newAmountPaise: Paise;
  formatMoney: (value: Paise) => string;
}): ValidationResult {
  const total = input.alreadyReceivedPaise + input.newAmountPaise;
  if (total <= input.budgetPaise) return ok;

  const headroom = clampToZero(input.budgetPaise - input.alreadyReceivedPaise);
  return {
    ok: false,
    message:
      `This receipt would take total collections to ${input.formatMoney(total)}, above the agreed ` +
      `project budget of ${input.formatMoney(input.budgetPaise)}. At most ` +
      `${input.formatMoney(headroom)} can still be recorded — raise the budget first if the scope grew.`,
  };
}

/** An allocation may exceed neither the receipt nor the schedule line. */
export function checkAllocation(input: {
  allocationPaise: Paise;
  receiptUnallocatedPaise: Paise;
  scheduleOutstandingPaise: Paise;
  scheduleLabel: string;
  formatMoney: (value: Paise) => string;
}): ValidationResult {
  if (input.allocationPaise <= 0n) {
    return { ok: false, message: "An allocation must be greater than zero." };
  }
  if (input.allocationPaise > input.receiptUnallocatedPaise) {
    return {
      ok: false,
      message:
        `Cannot allocate ${input.formatMoney(input.allocationPaise)} — only ` +
        `${input.formatMoney(input.receiptUnallocatedPaise)} of this receipt is still unallocated.`,
    };
  }
  if (input.allocationPaise > input.scheduleOutstandingPaise) {
    return {
      ok: false,
      message:
        `Cannot allocate ${input.formatMoney(input.allocationPaise)} to "${input.scheduleLabel}" — ` +
        `only ${input.formatMoney(input.scheduleOutstandingPaise)} of that scheduled payment is unpaid.`,
    };
  }
  return ok;
}

/**
 * Greedily spreads a receipt over the schedule lines the user picked, oldest
 * due date first, never exceeding either side. Used when a receipt is recorded
 * with "apply to the earliest outstanding milestones".
 */
export function autoAllocate(
  receiptAmountPaise: Paise,
  schedules: readonly { id: string; dueDate: Date; outstandingPaise: Paise }[],
): { scheduleId: string; amountPaise: Paise }[] {
  let remaining = receiptAmountPaise;
  const result: { scheduleId: string; amountPaise: Paise }[] = [];

  for (const schedule of [...schedules].sort((a, b) => compareDates(a.dueDate, b.dueDate))) {
    if (remaining <= 0n) break;
    const take = minPaise(remaining, schedule.outstandingPaise);
    if (take <= 0n) continue;
    result.push({ scheduleId: schedule.id, amountPaise: take });
    remaining -= take;
  }

  return result;
}
