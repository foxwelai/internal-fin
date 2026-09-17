import { cache } from "react";

import { prisma } from "@/lib/db";
import { requirePageUser, requirePermission } from "@/lib/auth";
import { todayInIST } from "@/lib/dates";

import { indexDataset, type FinanceIndex } from "./engine";
import type {
  EngineCashMovement,
  EngineCommissionPayment,
  EngineExpense,
  EngineExpensePayment,
  EngineLoan,
  EngineLoanPayment,
  EngineProject,
  EngineReceipt,
  EngineSchedule,
  FinanceDataset,
} from "./types";

/**
 * Loads the whole financial picture once per request and hands it to the
 * engine.
 *
 * Every figure derives from the same snapshot, so a project's remaining
 * balance on the Projects page and the collections total on Overview cannot
 * drift apart. For an internal book of a few thousand rows this is a handful
 * of indexed queries; if the dataset ever outgrows that, the seams to add
 * date-windowing are the individual `findMany` calls below.
 *
 * `cache()` deduplicates the load across all the server components rendering
 * within a single request.
 */
export async function fetchFinanceDataset(): Promise<FinanceDataset> {
  const [
    projects,
    schedules,
    receipts,
    allocations,
    expenses,
    expensePayments,
    commissionPayments,
    loans,
    loanPayments,
    cashMovements,
    settings,
  ] = await Promise.all([
    prisma.project.findMany({
      include: { client: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.paymentSchedule.findMany({ orderBy: { dueDate: "asc" } }),
    prisma.receipt.findMany({ orderBy: { receivedOn: "asc" } }),
    prisma.receiptAllocation.findMany(),
    prisma.monthlyExpense.findMany({ orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }] }),
    prisma.expensePayment.findMany({ orderBy: { paidOn: "asc" } }),
    prisma.commissionPayment.findMany({ orderBy: { paidOn: "asc" } }),
    prisma.loan.findMany({ orderBy: { receivedOn: "asc" } }),
    prisma.loanPayment.findMany({ orderBy: { paidOn: "asc" } }),
    prisma.cashMovement.findMany({ orderBy: { occurredOn: "asc" } }),
    prisma.appSettings.findUnique({ where: { id: "singleton" } }),
  ]);

  const dataset: FinanceDataset = {
    projects: projects.map(
      (row): EngineProject => ({
        id: row.id,
        clientId: row.clientId,
        clientName: row.client.name,
        name: row.name,
        status: row.status,
        budgetPaise: row.budgetPaise,
        startDate: row.startDate,
        expectedCompletionDate: row.expectedCompletionDate,
        archivedAt: row.archivedAt,
        billingType: row.billingType,
        recurringInterval: row.recurringInterval,
        recurringAmountPaise: row.recurringAmountPaise,
        commissionBasis: row.commissionBasis,
        commissionPayee: row.commissionPayee,
        commissionRateBps: row.commissionRateBps,
        commissionAmountPaise: row.commissionAmountPaise,
      }),
    ),
    schedules: schedules.map(
      (row): EngineSchedule => ({
        id: row.id,
        projectId: row.projectId,
        label: row.label,
        amountPaise: row.amountPaise,
        dueDate: row.dueDate,
        notes: row.notes,
        archivedAt: row.archivedAt,
      }),
    ),
    receipts: receipts.map(
      (row): EngineReceipt => ({
        id: row.id,
        projectId: row.projectId,
        amountPaise: row.amountPaise,
        receivedOn: row.receivedOn,
        method: row.method,
        reference: row.reference,
      }),
    ),
    allocations: allocations.map((row) => ({
      receiptId: row.receiptId,
      scheduleId: row.scheduleId,
      amountPaise: row.amountPaise,
    })),
    expenses: expenses.map(
      (row): EngineExpense => ({
        id: row.id,
        name: row.name,
        category: row.category,
        plannedPaise: row.plannedPaise,
        periodYear: row.periodYear,
        periodMonth: row.periodMonth,
        dueDate: row.dueDate,
        isRecurring: row.isRecurring,
        archivedAt: row.archivedAt,
      }),
    ),
    expensePayments: expensePayments.map(
      (row): EngineExpensePayment => ({
        id: row.id,
        expenseId: row.expenseId,
        amountPaise: row.amountPaise,
        paidOn: row.paidOn,
      }),
    ),
    commissionPayments: commissionPayments.map(
      (row): EngineCommissionPayment => ({
        id: row.id,
        projectId: row.projectId,
        amountPaise: row.amountPaise,
        paidOn: row.paidOn,
      }),
    ),
    loans: loans.map(
      (row): EngineLoan => ({
        id: row.id,
        lender: row.lender,
        principalPaise: row.principalPaise,
        interestRateBps: row.interestRateBps,
        receivedOn: row.receivedOn,
        dueDate: row.dueDate,
        status: row.status,
      }),
    ),
    loanPayments: loanPayments.map(
      (row): EngineLoanPayment => ({
        id: row.id,
        loanId: row.loanId,
        amountPaise: row.amountPaise,
        paidOn: row.paidOn,
      }),
    ),
    cashMovements: cashMovements.map(
      (row): EngineCashMovement => ({
        id: row.id,
        type: row.type,
        amountPaise: row.amountPaise,
        occurredOn: row.occurredOn,
        label: row.label,
      }),
    ),
    openingBalance:
      settings?.openingBalancePaise != null && settings.openingBalanceDate != null
        ? { amountPaise: settings.openingBalancePaise, effectiveDate: settings.openingBalanceDate }
        : null,
    today: todayInIST(),
  };

  return dataset;
}

/** Request-scoped: every server component in one render shares this snapshot. */
export const loadFinanceIndex = cache(async (): Promise<FinanceIndex> => {
  // Checked here, at the data source, not only in the layout: Next.js renders
  // route segments independently, so a layout that shows a waiting screen does
  // not stop a page from running. Every screen reads through these loaders.
  await requirePageUser();
  return indexDataset(await fetchFinanceDataset());
});

export const loadSettings = cache(async () => {
  await requirePageUser();
  const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  return (
    settings ?? {
      id: "singleton",
      companyName: "foxwel.ai",
      openingBalancePaise: null,
      openingBalanceDate: null,
      fiscalYearStartMonth: 4,
      updatedAt: new Date(),
    }
  );
});

export const loadClients = cache(async () => {
  await requirePageUser();
  return prisma.client.findMany({
    orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
    include: { _count: { select: { projects: true } } },
  });
});

/** True when any row is flagged as demo data — drives the Settings banner. */
export const hasDemoData = cache(async () => {
  await requirePageUser();
  const count = await prisma.client.count({ where: { isDemo: true } });
  return count > 0;
});

/** The team, for the Settings page: requests awaiting a decision, then members. */
export const loadTeam = cache(async () => {
  await requirePermission("users:manage");
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      approvedAt: true,
      clerkUserId: true,
      lastLoginAt: true,
      createdAt: true,
      approvedBy: { select: { name: true } },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  const pending = users.filter((user) => user.approvedAt === null && user.isActive);
  const declined = users.filter((user) => user.approvedAt === null && !user.isActive);
  const members = users
    .filter((user) => user.approvedAt !== null)
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));

  const activeSuperAdmins = members.filter(
    (user) => user.role === "SUPER_ADMIN" && user.isActive,
  ).length;

  return { pending, declined, members, activeSuperAdmins };
});

/** Loans and their repayments, for the Loans page. */
export const loadLoans = cache(async () => {
  await requirePageUser();
  return prisma.loan.findMany({
    orderBy: [{ status: "asc" }, { receivedOn: "desc" }],
    include: { payments: { orderBy: { paidOn: "desc" } } },
  });
});
