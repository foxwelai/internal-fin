import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { csvAttachmentHeaders, toCsv, withBom } from "@/lib/csv";
import { formatForCsv } from "@/lib/money";
import {
  compareDates,
  formatMonthKey,
  isInMonth,
  monthStart,
  toDateInputValue,
} from "@/lib/dates";
import { loadFinanceIndex, loadProjectDelivery } from "@/lib/finance/repository";
import { forecastableScheduleRollups } from "@/lib/finance/engine";
import {
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  PROJECT_PROGRESS_LABELS,
  PROJECT_STATUS_LABELS,
  SCHEDULE_STATE_LABELS,
} from "@/lib/finance/labels";
import { resolveMonth } from "@/lib/finance/page-helpers";
import type { ExpenseCategory, ProjectProgress, ProjectStatus } from "@/lib/finance/types";

const DATASETS = ["clients", "projects", "payments", "expenses"] as const;
type Dataset = (typeof DATASETS)[number];

/**
 * CSV export that mirrors exactly what is on screen: the same query parameters
 * the page was filtered by are applied here, so the file and the table always
 * agree. Amounts are written as plain decimal rupees for spreadsheets.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dataset: string }> },
) {
  // An approved account, read from the database — a Clerk session alone is
  // not enough, or a pending sign-up could download the books.
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const { dataset } = await params;
  if (!DATASETS.includes(dataset as Dataset)) {
    return NextResponse.json({ error: "Unknown dataset" }, { status: 404 });
  }

  const search = Object.fromEntries(request.nextUrl.searchParams.entries());
  const month = resolveMonth(search);
  const monthKey = formatMonthKey(month);
  const query = (search.q ?? "").trim().toLowerCase();

  const index = await loadFinanceIndex();
  let rows: (string | number | null)[][];
  let filename: string;

  switch (dataset as Dataset) {
    case "clients": {
      const showArchived = search.archived === "1";
      const totals = new Map<string, { collected: bigint; outstanding: bigint; overdue: bigint; count: number }>();
      for (const rollup of index.projectRollups.values()) {
        if (rollup.project.archivedAt !== null) continue;
        const current = totals.get(rollup.project.clientId) ?? {
          collected: 0n,
          outstanding: 0n,
          overdue: 0n,
          count: 0,
        };
        current.collected += rollup.receivedPaise;
        current.count += 1;
        if (rollup.isForecastable) {
          current.outstanding += rollup.scheduledOutstandingPaise;
          current.overdue += rollup.overduePaise;
        }
        totals.set(rollup.project.clientId, current);
      }

      const { prisma } = await import("@/lib/db");
      const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });

      rows = [
        ["Company", "Client name", "Client phone", "Contact person", "Contact phone", "Email", "Website", "Registered name", "Projects", "Collected (INR)", "Scheduled outstanding (INR)", "Overdue (INR)", "Status", "Notes"],
        ...clients
          .filter((client) => (showArchived ? true : client.archivedAt === null))
          .filter((client) =>
            query
              ? [client.name, client.companyName, client.clientName, client.contactPerson, client.email, client.phone, client.contactPhone]
                  .some((field) => (field ?? "").toLowerCase().includes(query))
              : true,
          )
          .map((client) => {
            const total = totals.get(client.id);
            return [
              client.name,
              client.clientName,
              client.phone,
              client.contactPerson,
              client.contactPhone,
              client.email,
              client.website,
              client.companyName,
              total?.count ?? 0,
              formatForCsv(total?.collected ?? 0n),
              formatForCsv(total?.outstanding ?? 0n),
              formatForCsv(total?.overdue ?? 0n),
              client.archivedAt ? "Archived" : "Active",
              client.notes,
            ];
          }),
      ];
      filename = "foxwel-clients.csv";
      break;
    }

    case "projects": {
      const showArchived = search.archived === "1";
      const status = search.status as ProjectStatus | undefined;
      const progress = search.progress as ProjectProgress | undefined;
      const deliveries = await loadProjectDelivery();

      rows = [
        ["Client", "Project", "Status", "Progress", "Complete (%)", "What's completed", "Foxwel coordinator", "Coordinator phone", "Budget (INR)", "Received (INR)", "Remaining (INR)", "Scheduled outstanding (INR)", "Unscheduled (INR)", "Overdue (INR)", "Next payment date", "Start date", "Expected completion", "Archived"],
        ...[...index.projectRollups.values()]
          .filter((rollup) => (showArchived ? true : rollup.project.archivedAt === null))
          .filter((rollup) => (status ? rollup.project.status === status : true))
          .filter((rollup) => (progress ? deliveries.get(rollup.project.id)?.progress === progress : true))
          .filter((rollup) =>
            query
              ? `${rollup.project.name} ${rollup.project.clientName} ${deliveries.get(rollup.project.id)?.coordinator?.name ?? ""}`
                  .toLowerCase()
                  .includes(query)
              : true,
          )
          .map((rollup) => [
            rollup.project.clientName,
            rollup.project.name,
            PROJECT_STATUS_LABELS[rollup.project.status],
            PROJECT_PROGRESS_LABELS[deliveries.get(rollup.project.id)?.progress ?? "NOT_STARTED"],
            deliveries.get(rollup.project.id)?.progressPercent ?? 0,
            deliveries.get(rollup.project.id)?.progressNotes ?? null,
            deliveries.get(rollup.project.id)?.coordinator?.name ?? null,
            deliveries.get(rollup.project.id)?.coordinator?.phone ?? null,
            formatForCsv(rollup.budgetPaise),
            formatForCsv(rollup.receivedPaise),
            formatForCsv(rollup.remainingBalancePaise),
            formatForCsv(rollup.scheduledOutstandingPaise),
            formatForCsv(rollup.unscheduledPaise),
            formatForCsv(rollup.overduePaise),
            toDateInputValue(rollup.nextPaymentDate),
            toDateInputValue(rollup.project.startDate),
            toDateInputValue(rollup.project.expectedCompletionDate),
            rollup.project.archivedAt ? "Yes" : "No",
          ]),
      ];
      filename = "foxwel-projects.csv";
      break;
    }

    case "payments": {
      const view = search.view ?? "scheduled";
      const describe = (projectId: string) => index.projectsById.get(projectId);

      if (view === "received") {
        rows = [
          ["Receipt date", "Client", "Project", "Amount (INR)", "Method", "Reference", "Allocated (INR)", "Unallocated (INR)"],
          ...index.dataset.receipts
            .filter((receipt) => isInMonth(receipt.receivedOn, month))
            .sort((a, b) => compareDates(b.receivedOn, a.receivedOn))
            .map((receipt) => {
              const rollup = index.receiptRollups.get(receipt.id);
              const project = describe(receipt.projectId);
              return [
                toDateInputValue(receipt.receivedOn),
                project?.clientName ?? "",
                project?.name ?? "",
                formatForCsv(receipt.amountPaise),
                PAYMENT_METHOD_LABELS[receipt.method],
                receipt.reference,
                formatForCsv(rollup?.allocatedPaise ?? 0n),
                formatForCsv(rollup?.unallocatedPaise ?? 0n),
              ];
            }),
        ];
        filename = `foxwel-receipts-${monthKey}.csv`;
      } else {
        const start = monthStart(month);
        const all = forecastableScheduleRollups(index).filter((row) => row.outstandingPaise > 0n);
        const selected =
          view === "overdue"
            ? all.filter((row) => row.state === "OVERDUE")
            : all.filter((row) => isInMonth(row.schedule.dueDate, month));

        rows = [
          ["Due date", "Client", "Project", "Milestone", "Expected (INR)", "Received (INR)", "Outstanding (INR)", "State", "Days overdue", "Belongs to selected month"],
          ...selected
            .sort((a, b) => compareDates(a.schedule.dueDate, b.schedule.dueDate))
            .map((row) => {
              const project = describe(row.schedule.projectId);
              return [
                toDateInputValue(row.schedule.dueDate),
                project?.clientName ?? "",
                project?.name ?? "",
                row.schedule.label,
                formatForCsv(row.schedule.amountPaise),
                formatForCsv(row.allocatedPaise),
                formatForCsv(row.outstandingPaise),
                SCHEDULE_STATE_LABELS[row.state],
                row.daysOverdue,
                compareDates(row.schedule.dueDate, start) < 0 ? "No — carried forward" : "Yes",
              ];
            }),
        ];
        filename = `foxwel-scheduled-payments-${monthKey}.csv`;
      }
      break;
    }

    case "expenses": {
      const category = search.category as ExpenseCategory | undefined;

      rows = [
        ["Month", "Name", "Category", "Planned (INR)", "Paid (INR)", "Outstanding (INR)", "Due date", "Recurring", "State", "Notes"],
        ...index.dataset.expenses
          .filter((expense) => expense.periodYear === month.year && expense.periodMonth === month.month)
          .filter((expense) => expense.archivedAt === null)
          .filter((expense) => (category ? expense.category === category : true))
          .filter((expense) => (query ? expense.name.toLowerCase().includes(query) : true))
          .map((expense) => {
            const rollup = index.expenseRollups.get(expense.id);
            return [
              monthKey,
              expense.name,
              EXPENSE_CATEGORY_LABELS[expense.category],
              formatForCsv(expense.plannedPaise),
              formatForCsv(rollup?.paidPaise ?? 0n),
              formatForCsv(rollup?.outstandingPaise ?? 0n),
              toDateInputValue(expense.dueDate),
              expense.isRecurring ? "Yes" : "No",
              rollup?.state ?? "UNPAID",
              null,
            ];
          }),
      ];
      filename = `foxwel-expenses-${monthKey}.csv`;
      break;
    }
  }

  return new NextResponse(withBom(toCsv(rows)), { headers: csvAttachmentHeaders(filename) });
}
