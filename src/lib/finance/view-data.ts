import "server-only";

import { toWire } from "@/lib/money";
import { toDateInputValue } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";

import { loadClients, loadFinanceIndex, loadTeamMembers } from "./repository";
import type { ClientOption, ProjectOption, TeamOption } from "@/components/finance/options";

/** Client, project and team pickers for the quick-action dialogs. */
export async function loadPickerOptions(): Promise<{
  clients: ClientOption[];
  projects: ProjectOption[];
  team: TeamOption[];
}> {
  await requirePageUser();
  const [index, clients, details, members] = await Promise.all([
    loadFinanceIndex(),
    loadClients(),
    // Fields the engine has no reason to carry, but the edit form needs.
    prisma.project.findMany({
      select: {
        id: true,
        description: true,
        notes: true,
        projectUrl: true,
        commissionNotes: true,
        coordinatorId: true,
        progress: true,
        progressPercent: true,
        progressNotes: true,
      },
    }),
    loadTeamMembers(),
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
      coordinatorId: detailById.get(rollup.project.id)?.coordinatorId ?? null,
      progress: detailById.get(rollup.project.id)?.progress ?? "NOT_STARTED",
      progressPercent: detailById.get(rollup.project.id)?.progressPercent ?? 0,
      progressNotes: detailById.get(rollup.project.id)?.progressNotes ?? null,
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
    team: members.map((member) => ({
      id: member.id,
      kind: member.kind,
      name: member.name,
      phone: member.phone,
      designation: member.designation,
      active: member.isActive,
    })),
  };
}
