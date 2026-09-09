import { describe, expect, it } from "vitest";

import {
  autoAllocate,
  cashPositionAsOf,
  checkAllocation,
  checkReceiptWithinBudget,
  compareToPreviousMonth,
  expenseCategoryBreakdown,
  indexDataset,
  pipelineTotals,
  potentialPipelinePaise,
  receivablesAgeing,
  summariseMonth,
} from "./engine";
import { planMonthCopy, planRecurringGeneration } from "./recurring";
import type {
  EngineExpense,
  EngineExpensePayment,
  EngineProject,
  EngineReceipt,
  EngineSchedule,
  FinanceDataset,
  ProjectStatus,
} from "./types";
import { formatINR, formatPercent, parseRupeesToPaise, rupees } from "@/lib/money";
import { parseDateInput } from "@/lib/dates";

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const SEPTEMBER = { year: 2026, month: 9 };
const OCTOBER = { year: 2026, month: 10 };
const AUGUST = { year: 2026, month: 8 };

/** Mid-September, so "today" sits inside the month under test. */
const TODAY = date("2026-09-15");

function date(value: string): Date {
  const parsed = parseDateInput(value);
  if (!parsed) throw new Error(`bad fixture date: ${value}`);
  return parsed;
}

function project(overrides: Partial<EngineProject> & { id: string }): EngineProject {
  return {
    clientId: "client-1",
    clientName: "Northwind Retail",
    name: "Website revamp",
    status: "APPROVED" as ProjectStatus,
    budgetPaise: rupees(100_000),
    startDate: date("2026-09-01"),
    expectedCompletionDate: date("2026-11-30"),
    archivedAt: null,
    ...overrides,
  };
}

function schedule(overrides: Partial<EngineSchedule> & { id: string }): EngineSchedule {
  return {
    projectId: "project-1",
    label: "Milestone",
    amountPaise: rupees(10_000),
    dueDate: date("2026-09-20"),
    notes: null,
    archivedAt: null,
    ...overrides,
  };
}

function receipt(overrides: Partial<EngineReceipt> & { id: string }): EngineReceipt {
  return {
    projectId: "project-1",
    amountPaise: rupees(10_000),
    receivedOn: date("2026-09-05"),
    method: "BANK_TRANSFER",
    reference: null,
    ...overrides,
  };
}

function expense(overrides: Partial<EngineExpense> & { id: string }): EngineExpense {
  return {
    name: "Salaries",
    category: "SALARIES",
    plannedPaise: rupees(50_000),
    periodYear: 2026,
    periodMonth: 9,
    dueDate: date("2026-09-07"),
    isRecurring: true,
    archivedAt: null,
    ...overrides,
  };
}

function dataset(overrides: Partial<FinanceDataset> = {}): FinanceDataset {
  return {
    projects: [],
    schedules: [],
    receipts: [],
    allocations: [],
    expenses: [],
    expensePayments: [],
    cashMovements: [],
    openingBalance: null,
    today: TODAY,
    ...overrides,
  };
}

const build = (overrides: Partial<FinanceDataset> = {}) => indexDataset(dataset(overrides));

/* -------------------------------------------------------------------------- */
/* Money primitives                                                            */
/* -------------------------------------------------------------------------- */

describe("money", () => {
  it("parses Indian-grouped input into exact paise", () => {
    expect(parseRupeesToPaise("1,25,000")).toBe(12_500_000n);
    expect(parseRupeesToPaise("₹1,25,000.50")).toBe(12_500_050n);
    expect(parseRupeesToPaise("0.05")).toBe(5n);
  });

  it("rejects amounts finer than a paisa instead of rounding them away", () => {
    expect(() => parseRupeesToPaise("100.005")).toThrow(/two decimal places/i);
  });

  it("formats with Indian digit grouping", () => {
    expect(formatINR(12_500_000n)).toBe("₹1,25,000");
    expect(formatINR(240_000_000_00n)).toBe("₹24,00,00,000");
    expect(formatINR(-450_000n)).toBe("−₹4,500");
  });

  it("adds thousands of amounts without drifting, unlike floats", () => {
    // 0.1 + 0.2 in rupees is the classic float failure; in paise it is exact.
    const total = Array.from({ length: 10_000 }, () => parseRupeesToPaise("0.10")).reduce(
      (a, b) => a + b,
      0n,
    );
    expect(total).toBe(100_000n);
    expect(formatINR(total)).toBe("₹1,000");
  });
});

/* -------------------------------------------------------------------------- */
/* Brief §9 — the required verification cases                                  */
/* -------------------------------------------------------------------------- */

describe("verification case 1: remaining contract balance", () => {
  it("a ₹1,00,000 project with ₹30,000 received has ₹70,000 remaining", () => {
    const index = build({
      projects: [project({ id: "project-1", budgetPaise: rupees(100_000) })],
      receipts: [receipt({ id: "receipt-1", amountPaise: rupees(30_000) })],
    });

    const rollup = index.projectRollups.get("project-1")!;
    expect(rollup.receivedPaise).toBe(rupees(30_000));
    expect(rollup.remainingBalancePaise).toBe(rupees(70_000));
    expect(formatINR(rollup.remainingBalancePaise)).toBe("₹70,000");
  });
});

describe("verification case 2: only this month's schedule enters this month", () => {
  it("splits ₹70,000 into ₹40,000 now and ₹30,000 next month", () => {
    const index = build({
      projects: [project({ id: "project-1" })],
      receipts: [receipt({ id: "receipt-1", amountPaise: rupees(30_000) })],
      schedules: [
        schedule({ id: "s-sep", amountPaise: rupees(40_000), dueDate: date("2026-09-25") }),
        schedule({ id: "s-oct", amountPaise: rupees(30_000), dueDate: date("2026-10-10") }),
      ],
    });

    const september = summariseMonth(index, SEPTEMBER);
    expect(september.expectedAdditionalCollectionsPaise).toBe(rupees(40_000));
    expect(september.actualCollectionsPaise).toBe(rupees(30_000));
    expect(september.projectedCollectionsPaise).toBe(rupees(70_000));

    const october = summariseMonth(index, OCTOBER);
    expect(october.expectedAdditionalCollectionsPaise).toBe(rupees(30_000));
    expect(october.actualCollectionsPaise).toBe(0n);
  });

  it("counts the advance as budget consumed, never as extra revenue", () => {
    const index = build({
      projects: [project({ id: "project-1" })],
      receipts: [receipt({ id: "receipt-1", amountPaise: rupees(30_000) })],
      schedules: [
        schedule({ id: "s-sep", amountPaise: rupees(40_000), dueDate: date("2026-09-25") }),
        schedule({ id: "s-oct", amountPaise: rupees(30_000), dueDate: date("2026-10-10") }),
      ],
    });

    const rollup = index.projectRollups.get("project-1")!;
    // 30k in + 40k + 30k still scheduled = the ₹1,00,000 budget exactly.
    expect(rollup.receivedPaise + rollup.scheduledOutstandingPaise).toBe(rupees(100_000));
    expect(rollup.unscheduledPaise).toBe(0n);
  });
});

describe("verification case 3: a partial receipt reduces its schedule line once", () => {
  it("reduces the outstanding amount without double counting", () => {
    const index = build({
      projects: [project({ id: "project-1" })],
      schedules: [schedule({ id: "s-1", amountPaise: rupees(40_000), dueDate: date("2026-09-25") })],
      receipts: [receipt({ id: "r-1", amountPaise: rupees(15_000), receivedOn: date("2026-09-10") })],
      allocations: [{ receiptId: "r-1", scheduleId: "s-1", amountPaise: rupees(15_000) }],
    });

    const scheduleRollup = index.scheduleRollups.get("s-1")!;
    expect(scheduleRollup.allocatedPaise).toBe(rupees(15_000));
    expect(scheduleRollup.outstandingPaise).toBe(rupees(25_000));
    expect(scheduleRollup.state).toBe("PARTIALLY_PAID");

    const summary = summariseMonth(index, SEPTEMBER);
    expect(summary.actualCollectionsPaise).toBe(rupees(15_000));
    // The expectation shrinks by exactly what arrived, so projected total
    // stays at the ₹40,000 the milestone was always worth.
    expect(summary.expectedAdditionalCollectionsPaise).toBe(rupees(25_000));
    expect(summary.projectedCollectionsPaise).toBe(rupees(40_000));
  });

  it("keeps an unallocated receipt visible while still reducing the contract balance", () => {
    const index = build({
      projects: [project({ id: "project-1" })],
      receipts: [receipt({ id: "r-1", amountPaise: rupees(20_000) })],
    });

    const receiptRollup = index.receiptRollups.get("r-1")!;
    expect(receiptRollup.unallocatedPaise).toBe(rupees(20_000));

    const projectRollup = index.projectRollups.get("project-1")!;
    expect(projectRollup.remainingBalancePaise).toBe(rupees(80_000));
    expect(projectRollup.unallocatedReceiptsPaise).toBe(rupees(20_000));
  });
});

describe("verification case 4: pending and on-hold work stays out of the forecast", () => {
  it("excludes their schedules but keeps their actual receipts", () => {
    const index = build({
      projects: [
        project({ id: "approved", status: "APPROVED" }),
        project({ id: "pending", status: "PENDING", name: "Brand refresh" }),
        project({ id: "hold", status: "ON_HOLD", name: "Mobile app" }),
      ],
      schedules: [
        schedule({ id: "s-approved", projectId: "approved", amountPaise: rupees(40_000) }),
        schedule({ id: "s-pending", projectId: "pending", amountPaise: rupees(60_000) }),
        schedule({ id: "s-hold", projectId: "hold", amountPaise: rupees(80_000) }),
      ],
      receipts: [
        receipt({ id: "r-hold", projectId: "hold", amountPaise: rupees(25_000) }),
      ],
    });

    const summary = summariseMonth(index, SEPTEMBER);
    expect(summary.expectedAdditionalCollectionsPaise).toBe(rupees(40_000));
    // Real money from an on-hold project is still real money.
    expect(summary.actualCollectionsPaise).toBe(rupees(25_000));

    expect(potentialPipelinePaise(index)).toBe(rupees(100_000) + rupees(75_000));

    const totals = pipelineTotals(index);
    expect(totals.find((row) => row.status === "PENDING")?.projectCount).toBe(1);
    expect(totals.find((row) => row.status === "ON_HOLD")?.receivedPaise).toBe(rupees(25_000));
  });

  it("ignores archived projects entirely", () => {
    const index = build({
      projects: [project({ id: "archived", archivedAt: new Date("2026-08-01T00:00:00Z") })],
      schedules: [schedule({ id: "s-1", projectId: "archived", amountPaise: rupees(50_000) })],
    });
    expect(summariseMonth(index, SEPTEMBER).expectedAdditionalCollectionsPaise).toBe(0n);
  });
});

describe("verification case 5: unscheduled balances never enter a forecast", () => {
  it("reports the gap without adding it to any month", () => {
    const index = build({
      projects: [project({ id: "project-1", budgetPaise: rupees(100_000) })],
      receipts: [receipt({ id: "r-1", amountPaise: rupees(30_000) })],
      schedules: [schedule({ id: "s-1", amountPaise: rupees(20_000), dueDate: date("2026-09-25") })],
    });

    const rollup = index.projectRollups.get("project-1")!;
    expect(rollup.remainingBalancePaise).toBe(rupees(70_000));
    expect(rollup.scheduledOutstandingPaise).toBe(rupees(20_000));
    expect(rollup.unscheduledPaise).toBe(rupees(50_000));

    for (const month of [AUGUST, SEPTEMBER, OCTOBER]) {
      const summary = summariseMonth(index, month);
      expect(summary.expectedAdditionalCollectionsPaise).toBeLessThanOrEqual(rupees(20_000));
    }
    expect(summariseMonth(index, SEPTEMBER).expectedAdditionalCollectionsPaise).toBe(rupees(20_000));
    expect(summariseMonth(index, OCTOBER).expectedAdditionalCollectionsPaise).toBe(0n);
  });
});

describe("verification case 6: prior-month overdue stays separate", () => {
  it("reports carried-forward overdue outside the current month's forecast", () => {
    const index = build({
      projects: [project({ id: "project-1", budgetPaise: rupees(200_000) })],
      schedules: [
        schedule({ id: "s-jul", amountPaise: rupees(25_000), dueDate: date("2026-07-15") }),
        schedule({ id: "s-sep-past", amountPaise: rupees(10_000), dueDate: date("2026-09-05") }),
        schedule({ id: "s-sep-future", amountPaise: rupees(40_000), dueDate: date("2026-09-25") }),
      ],
    });

    const summary = summariseMonth(index, SEPTEMBER);

    // Only September due dates are forecast, overdue or not.
    expect(summary.expectedAdditionalCollectionsPaise).toBe(rupees(50_000));
    expect(summary.overdueInMonth.amountPaise).toBe(rupees(10_000));
    expect(summary.overdueInMonth.count).toBe(1);

    // July's is surfaced on its own and deliberately not added in.
    expect(summary.overdueCarriedForward.amountPaise).toBe(rupees(25_000));
    expect(summary.overdueCarriedForward.count).toBe(1);
    expect(summary.projectedCollectionsPaise).toBe(rupees(50_000));
  });

  it("brings a rescheduled amount into the month once its due date moves", () => {
    const rescheduled = build({
      projects: [project({ id: "project-1", budgetPaise: rupees(200_000) })],
      schedules: [schedule({ id: "s-jul", amountPaise: rupees(25_000), dueDate: date("2026-09-28") })],
    });

    const summary = summariseMonth(rescheduled, SEPTEMBER);
    expect(summary.overdueCarriedForward.amountPaise).toBe(0n);
    expect(summary.expectedAdditionalCollectionsPaise).toBe(rupees(25_000));
  });
});

describe("verification case 7: cash out follows the payment date, not the budget month", () => {
  it("marks a part-paid expense overdue once its due date has passed", () => {
    const index = build({
      expenses: [expense({ id: "e-1", plannedPaise: rupees(50_000), dueDate: date("2026-09-07") })],
      expensePayments: [
        { id: "p-1", expenseId: "e-1", amountPaise: rupees(20_000), paidOn: date("2026-09-06") },
      ],
    });
    const rollup = index.expenseRollups.get("e-1")!;
    expect(rollup.state).toBe("OVERDUE");
    expect(rollup.daysOverdue).toBe(8);
  });

  it("charges a September payment for an August expense to September", () => {
    const august = expense({
      id: "e-aug",
      name: "August office rent",
      category: "RENT",
      plannedPaise: rupees(35_000),
      periodYear: 2026,
      periodMonth: 8,
      dueDate: date("2026-08-05"),
    });
    const payments: EngineExpensePayment[] = [
      { id: "p-1", expenseId: "e-aug", amountPaise: rupees(35_000), paidOn: date("2026-09-03") },
    ];

    const index = build({ expenses: [august], expensePayments: payments });

    const augustSummary = summariseMonth(index, AUGUST);
    expect(augustSummary.plannedExpensesPaise).toBe(rupees(35_000));
    expect(augustSummary.actualCashOutflowPaise).toBe(0n);
    // The August budget line is settled, so nothing is still outstanding for it.
    expect(augustSummary.outstandingExpensesPaise).toBe(0n);

    const septemberSummary = summariseMonth(index, SEPTEMBER);
    expect(septemberSummary.plannedExpensesPaise).toBe(0n);
    expect(septemberSummary.actualCashOutflowPaise).toBe(rupees(35_000));
    expect(septemberSummary.actualSurplusPaise).toBe(-rupees(35_000));
  });

  it("counts a partial expense payment and leaves the rest outstanding", () => {
    const index = build({
      // Due later in the month, so the remainder is merely unpaid, not late.
      expenses: [expense({ id: "e-1", plannedPaise: rupees(50_000), dueDate: date("2026-09-25") })],
      expensePayments: [
        { id: "p-1", expenseId: "e-1", amountPaise: rupees(20_000), paidOn: date("2026-09-06") },
      ],
    });

    const rollup = index.expenseRollups.get("e-1")!;
    expect(rollup.paidPaise).toBe(rupees(20_000));
    expect(rollup.outstandingPaise).toBe(rupees(30_000));
    expect(rollup.state).toBe("PARTIALLY_PAID");

    const summary = summariseMonth(index, SEPTEMBER);
    expect(summary.actualCashOutflowPaise).toBe(rupees(20_000));
    expect(summary.projectedCashOutflowPaise).toBe(rupees(50_000));
  });
});

describe("verification case 8: recurring generation is idempotent", () => {
  const templates = [
    {
      id: "t-salaries",
      name: "Salaries",
      category: "SALARIES" as const,
      amountPaise: rupees(450_000),
      dueDayOfMonth: 1,
      isActive: true,
    },
    {
      id: "t-rent",
      name: "Office rent",
      category: "RENT" as const,
      amountPaise: rupees(65_000),
      dueDayOfMonth: 5,
      isActive: true,
    },
    {
      id: "t-old",
      name: "Retired tool",
      category: "SOFTWARE" as const,
      amountPaise: rupees(2_000),
      dueDayOfMonth: null,
      isActive: false,
    },
  ];

  it("creates each active template once and skips them on a re-run", () => {
    const first = planRecurringGeneration({
      templates,
      month: SEPTEMBER,
      alreadyGeneratedTemplateIds: new Set(),
    });
    expect(first.create).toHaveLength(2);
    expect(first.skip).toEqual([{ name: "Retired tool", reason: "inactive" }]);
    expect(first.create[0].dueDate).toEqual(date("2026-09-01"));

    const second = planRecurringGeneration({
      templates,
      month: SEPTEMBER,
      alreadyGeneratedTemplateIds: new Set(first.create.map((row) => row.templateId!)),
    });
    expect(second.create).toHaveLength(0);
    expect(second.skip.filter((row) => row.reason === "already-generated")).toHaveLength(2);
  });

  it("clamps a day-31 template into a short month", () => {
    const plan = planRecurringGeneration({
      templates: [{ ...templates[0], dueDayOfMonth: 31 }],
      month: { year: 2027, month: 2 },
      alreadyGeneratedTemplateIds: new Set(),
    });
    expect(plan.create[0].dueDate).toEqual(date("2027-02-28"));
  });

  it("does not double a budget when a month is copied twice", () => {
    const source = [
      {
        name: "Salaries",
        category: "SALARIES" as const,
        plannedPaise: rupees(450_000),
        dueDate: date("2026-08-01"),
        isRecurring: true,
        templateId: "t-salaries",
      },
    ];

    const first = planMonthCopy({ source, targetMonth: SEPTEMBER, existing: [] });
    expect(first.create).toHaveLength(1);
    expect(first.create[0].dueDate).toEqual(date("2026-09-01"));

    const second = planMonthCopy({
      source,
      targetMonth: SEPTEMBER,
      existing: [{ name: "Salaries", category: "SALARIES", templateId: "t-salaries" }],
    });
    expect(second.create).toHaveLength(0);
    expect(second.skip[0].reason).toBe("already-generated");
  });
});

describe("verification case 9: zero-income months do not divide by zero", () => {
  it("returns a null margin rather than NaN or Infinity", () => {
    const index = build({
      expenses: [expense({ id: "e-1", plannedPaise: rupees(80_000) })],
      expensePayments: [
        { id: "p-1", expenseId: "e-1", amountPaise: rupees(80_000), paidOn: date("2026-09-09") },
      ],
    });

    const summary = summariseMonth(index, SEPTEMBER);
    expect(summary.actualCollectionsPaise).toBe(0n);
    expect(summary.surplusMarginPercent).toBeNull();
    expect(summary.actualSurplusPaise).toBe(-rupees(80_000));
    // And the null reaches the screen as an em dash, not "NaN%" or "-Infinity".
    expect(formatPercent(summary.surplusMarginPercent)).toBe("—");
  });

  it("returns an entirely empty summary for a month with nothing in it", () => {
    const summary = summariseMonth(build(), SEPTEMBER);
    expect(summary.isEmpty).toBe(true);
    expect(summary.projectedSurplusPaise).toBe(0n);
    expect(summary.surplusMarginPercent).toBeNull();
  });

  it("gives a neutral comparison when the previous month holds no data", () => {
    const index = build({ receipts: [receipt({ id: "r-1", amountPaise: rupees(10_000) })] });
    const summary = summariseMonth(index, SEPTEMBER);
    expect(compareToPreviousMonth(index, summary, AUGUST)).toBeNull();
  });

  it("computes a real month-over-month delta when there is history", () => {
    const index = build({
      receipts: [
        receipt({ id: "r-aug", amountPaise: rupees(50_000), receivedOn: date("2026-08-10") }),
        receipt({ id: "r-sep", amountPaise: rupees(75_000), receivedOn: date("2026-09-10") }),
      ],
    });
    const comparison = compareToPreviousMonth(index, summariseMonth(index, SEPTEMBER), AUGUST);
    expect(comparison).not.toBeNull();
    expect(comparison!.collectionsDeltaPercent).toBe(50);
  });
});

describe("verification case 10: history survives a status change", () => {
  it("keeps receipts in actual collections after a project is put on hold", () => {
    const receipts = [
      receipt({ id: "r-1", amountPaise: rupees(30_000), receivedOn: date("2026-09-02") }),
    ];
    const schedules = [schedule({ id: "s-1", amountPaise: rupees(70_000), dueDate: date("2026-09-20") })];

    const approved = summariseMonth(
      build({ projects: [project({ id: "project-1", status: "APPROVED" })], receipts, schedules }),
      SEPTEMBER,
    );
    const onHold = summariseMonth(
      build({ projects: [project({ id: "project-1", status: "ON_HOLD" })], receipts, schedules }),
      SEPTEMBER,
    );

    expect(approved.actualCollectionsPaise).toBe(rupees(30_000));
    expect(onHold.actualCollectionsPaise).toBe(rupees(30_000));

    // Only the forward-looking expectation is withdrawn.
    expect(approved.expectedAdditionalCollectionsPaise).toBe(rupees(70_000));
    expect(onHold.expectedAdditionalCollectionsPaise).toBe(0n);
  });
});

/* -------------------------------------------------------------------------- */
/* Guard rails                                                                 */
/* -------------------------------------------------------------------------- */

describe("overpayment and allocation guards", () => {
  const formatMoney = (value: bigint) => formatINR(value);

  it("refuses a receipt that would exceed the project budget", () => {
    const result = checkReceiptWithinBudget({
      budgetPaise: rupees(100_000),
      alreadyReceivedPaise: rupees(90_000),
      newAmountPaise: rupees(20_000),
      formatMoney,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("₹10,000");
  });

  it("allows a receipt that lands exactly on the budget", () => {
    expect(
      checkReceiptWithinBudget({
        budgetPaise: rupees(100_000),
        alreadyReceivedPaise: rupees(90_000),
        newAmountPaise: rupees(10_000),
        formatMoney,
      }).ok,
    ).toBe(true);
  });

  it("refuses an allocation larger than the receipt's unallocated remainder", () => {
    const result = checkAllocation({
      allocationPaise: rupees(30_000),
      receiptUnallocatedPaise: rupees(10_000),
      scheduleOutstandingPaise: rupees(40_000),
      scheduleLabel: "Design approval",
      formatMoney,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("unallocated");
  });

  it("refuses an allocation larger than the schedule line's unpaid balance", () => {
    const result = checkAllocation({
      allocationPaise: rupees(30_000),
      receiptUnallocatedPaise: rupees(50_000),
      scheduleOutstandingPaise: rupees(12_000),
      scheduleLabel: "Design approval",
      formatMoney,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("Design approval");
  });

  it("spreads a receipt over the oldest outstanding milestones first", () => {
    const allocations = autoAllocate(rupees(50_000), [
      { id: "s-late", dueDate: date("2026-10-01"), outstandingPaise: rupees(30_000) },
      { id: "s-early", dueDate: date("2026-09-01"), outstandingPaise: rupees(20_000) },
    ]);
    expect(allocations).toEqual([
      { scheduleId: "s-early", amountPaise: rupees(20_000) },
      { scheduleId: "s-late", amountPaise: rupees(30_000) },
    ]);
  });

  it("leaves a remainder unallocated when the schedule cannot absorb it", () => {
    const allocations = autoAllocate(rupees(50_000), [
      { id: "s-1", dueDate: date("2026-09-01"), outstandingPaise: rupees(15_000) },
    ]);
    expect(allocations).toEqual([{ scheduleId: "s-1", amountPaise: rupees(15_000) }]);
  });
});

/* -------------------------------------------------------------------------- */
/* Breakdowns and cash position                                                */
/* -------------------------------------------------------------------------- */

describe("breakdowns", () => {
  it("shares expense categories out of the planned total", () => {
    const index = build({
      expenses: [
        expense({ id: "e-1", category: "SALARIES", plannedPaise: rupees(58_000) }),
        expense({ id: "e-2", name: "Rent", category: "RENT", plannedPaise: rupees(42_000) }),
      ],
    });

    const rows = expenseCategoryBreakdown(index, SEPTEMBER);
    expect(rows[0].category).toBe("SALARIES");
    expect(rows[0].shareOfPlanned).toBe(58);
    expect(rows[1].shareOfPlanned).toBe(42);
  });

  it("ages receivables from the due date", () => {
    const index = build({
      projects: [project({ id: "project-1", budgetPaise: rupees(500_000) })],
      schedules: [
        schedule({ id: "s-future", amountPaise: rupees(10_000), dueDate: date("2026-09-30") }),
        schedule({ id: "s-20d", amountPaise: rupees(20_000), dueDate: date("2026-08-26") }),
        schedule({ id: "s-45d", amountPaise: rupees(30_000), dueDate: date("2026-08-01") }),
        schedule({ id: "s-120d", amountPaise: rupees(40_000), dueDate: date("2026-05-18") }),
      ],
    });

    const rows = receivablesAgeing(index);
    const byBucket = Object.fromEntries(rows.map((row) => [row.bucket, row.amountPaise]));
    expect(byBucket.current).toBe(rupees(10_000));
    expect(byBucket["1-30"]).toBe(rupees(20_000));
    expect(byBucket["31-60"]).toBe(rupees(30_000));
    expect(byBucket["90+"]).toBe(rupees(40_000));
  });
});

describe("cash position", () => {
  it("is unavailable until an opening balance is configured", () => {
    expect(cashPositionAsOf(build(), date("2026-09-30"))).toBeNull();
  });

  it("keeps funding and owner draws out of the operating result", () => {
    const index = build({
      openingBalance: { amountPaise: rupees(500_000), effectiveDate: date("2026-09-01") },
      receipts: [receipt({ id: "r-1", amountPaise: rupees(75_000), receivedOn: date("2026-09-10") })],
      expenses: [expense({ id: "e-1", plannedPaise: rupees(40_000) })],
      expensePayments: [
        { id: "p-1", expenseId: "e-1", amountPaise: rupees(40_000), paidOn: date("2026-09-12") },
      ],
      cashMovements: [
        {
          id: "m-1",
          type: "OWNER_CONTRIBUTION",
          amountPaise: rupees(200_000),
          occurredOn: date("2026-09-04"),
          label: "Founder top-up",
        },
        {
          id: "m-2",
          type: "OWNER_WITHDRAWAL",
          amountPaise: rupees(50_000),
          occurredOn: date("2026-09-20"),
          label: "Owner draw",
        },
      ],
    });

    const position = cashPositionAsOf(index, date("2026-09-30"))!;
    expect(position.nonOperatingNetPaise).toBe(rupees(150_000));
    expect(position.closingBalancePaise).toBe(rupees(685_000));

    // The operating view is untouched by the ₹1,50,000 of non-operating cash.
    const summary = summariseMonth(index, SEPTEMBER);
    expect(summary.actualCollectionsPaise).toBe(rupees(75_000));
    expect(summary.actualSurplusPaise).toBe(rupees(35_000));
  });

  it("ignores movements dated before the opening balance takes effect", () => {
    const index = build({
      openingBalance: { amountPaise: rupees(100_000), effectiveDate: date("2026-09-01") },
      receipts: [receipt({ id: "r-old", amountPaise: rupees(90_000), receivedOn: date("2026-08-20") })],
    });
    expect(cashPositionAsOf(index, date("2026-09-30"))!.closingBalancePaise).toBe(rupees(100_000));
  });
});

describe("surplus margin", () => {
  it("is the actual surplus over actual collections", () => {
    const index = build({
      receipts: [receipt({ id: "r-1", amountPaise: rupees(200_000), receivedOn: date("2026-09-04") })],
      expenses: [expense({ id: "e-1", plannedPaise: rupees(150_000) })],
      expensePayments: [
        { id: "p-1", expenseId: "e-1", amountPaise: rupees(150_000), paidOn: date("2026-09-05") },
      ],
    });
    const summary = summariseMonth(index, SEPTEMBER);
    expect(summary.actualSurplusPaise).toBe(rupees(50_000));
    expect(summary.surplusMarginPercent).toBe(25);
  });
});
