import "server-only";

import { toWire } from "@/lib/money";
import { toDateInputValue } from "@/lib/dates";
import { prisma } from "@/lib/db";

import { loadClients, loadFinanceIndex } from "./repository";
import type { ClientOption, ProjectOption } from "@/components/finance/options";

/** Client + project pickers for the quick-action dialogs. */
export async function loadPickerOptions(): Promise<{
  clients: ClientOption[];
  projects: ProjectOption[];
}> {
  const [index, clients, details] = await Promise.all([
    loadFinanceIndex(),
    loadClients(),
    // Free-text fields the engine has no reason to carry, but the edit form needs.
    prisma.project.findMany({
      select: { id: true, description: true, notes: true, projectUrl: true, commissionNotes: true },
    }),
  ]);
  const detailById = new Map(details.map((row) => [row.id, row]));

  const projects: ProjectOption[] = [...index.projectRollups.values()]
    .filter((rollup) => rollup.project.archivedAt === null)
    .sort((a, b) =>
      `${a.project.clientName} ${a.project.name}`.localeCompare(
        `${b.project.clientName} ${b.project.name}`,
      ),
    )
    .map((rollup) => ({
      id: rollup.project.id,
      name: rollup.project.name,
      clientId: rollup.project.clientId,
      clientName: rollup.project.clientName,
      status: rollup.project.status,
      description: detailById.get(rollup.project.id)?.description ?? null,
      notes: detailById.get(rollup.project.id)?.notes ?? null,
      startDate: toDateInputValue(rollup.project.startDate) || null,
      expectedCompletionDate: toDateInputValue(rollup.project.expectedCompletionDate) || null,
      budgetPaise: toWire(rollup.budgetPaise),
      receivedPaise: toWire(rollup.receivedPaise),
      remainingPaise: toWire(rollup.remainingBalancePaise),
      scheduledOutstandingPaise: toWire(rollup.scheduledOutstandingPaise),
      unscheduledPaise: toWire(rollup.unscheduledPaise),
      projectUrl: detailById.get(rollup.project.id)?.projectUrl ?? null,

      billingType: rollup.project.billingType,
      recurringInterval: rollup.project.recurringInterval,
      recurringAmountPaise:
        rollup.project.recurringAmountPaise === null
          ? null
          : toWire(rollup.project.recurringAmountPaise),
      annualisedRecurringPaise: toWire(rollup.annualisedRecurringPaise),

      commissionBasis: rollup.project.commissionBasis,
      commissionPayee: rollup.project.commissionPayee,
      commissionRateBps: rollup.project.commissionRateBps,
      commissionAmountPaise:
        rollup.project.commissionAmountPaise === null
          ? null
          : toWire(rollup.project.commissionAmountPaise),
      commissionNotes: detailById.get(rollup.project.id)?.commissionNotes ?? null,
      commissionDuePaise: toWire(rollup.commissionDuePaise),
      commissionPaidPaise: toWire(rollup.commissionPaidPaise),
      commissionOutstandingPaise: toWire(rollup.commissionOutstandingPaise),
      schedules: (index.schedulesByProjectId.get(rollup.project.id) ?? [])
        .map((schedule) => index.scheduleRollups.get(schedule.id))
        .filter((row) => row !== undefined)
        .sort((a, b) => a.schedule.dueDate.getTime() - b.schedule.dueDate.getTime())
        .map((row) => ({
          id: row.schedule.id,
          label: row.schedule.label,
          dueDate: toDateInputValue(row.schedule.dueDate),
          amountPaise: toWire(row.schedule.amountPaise),
          outstandingPaise: toWire(row.outstandingPaise),
          overdue: row.state === "OVERDUE",
        })),
    }));

  return {
    clients: clients.map((client) => ({
      id: client.id,
      name: client.name,
      archived: client.archivedAt !== null,
    })),
    projects,
  };
}
