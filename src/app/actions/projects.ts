"use server";

import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectSchema } from "@/lib/validation/schemas";
import { PROJECT_STATUSES } from "@/lib/finance/types";
import { formatINR } from "@/lib/money";

import {
  failure,
  formValue,
  fromZodError,
  revalidateFinance,
  runAction,
  success,
  type ActionState,
} from "./helpers";

export async function saveProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const parsed = projectSchema.safeParse({
      id: formValue(formData, "id") || undefined,
      clientId: formValue(formData, "clientId"),
      name: formValue(formData, "name"),
      description: formValue(formData, "description"),
      budget: formValue(formData, "budget"),
      status: formValue(formData, "status"),
      startDate: formValue(formData, "startDate"),
      expectedCompletionDate: formValue(formData, "expectedCompletionDate"),
      projectUrl: formValue(formData, "projectUrl"),
      notes: formValue(formData, "notes"),
      billingType: formValue(formData, "billingType") || "ONE_TIME",
      recurringInterval: formValue(formData, "recurringInterval"),
      recurringAmount: formValue(formData, "recurringAmount"),
      commissionBasis: formValue(formData, "commissionBasis"),
      commissionPayee: formValue(formData, "commissionPayee"),
      commissionPercent: formValue(formData, "commissionPercent"),
      commissionAmount: formValue(formData, "commissionAmount"),
      commissionNotes: formValue(formData, "commissionNotes"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const {
      id,
      budget,
      recurringAmount,
      recurringInterval,
      commissionBasis,
      commissionPercent,
      commissionAmount,
      ...rest
    } = parsed.data;

    // Only keep the fields that belong to the chosen shape, so switching a
    // project back to one-off or clearing a commission does not leave a stale
    // amount behind that later reads as if it were still agreed.
    const isSubscription = rest.billingType === "SUBSCRIPTION";
    const billing = {
      recurringInterval: isSubscription ? recurringInterval : null,
      recurringAmountPaise: isSubscription ? recurringAmount : null,
    };
    const commission = {
      commissionBasis,
      commissionRateBps: commissionBasis === "PERCENT_OF_RECEIVED" ? commissionPercent : null,
      commissionAmountPaise: commissionBasis === "FIXED" ? commissionAmount : null,
      commissionPayee: commissionBasis ? rest.commissionPayee : null,
      commissionNotes: commissionBasis ? rest.commissionNotes : null,
    };

    const client = await prisma.client.findUnique({ where: { id: rest.clientId } });
    if (!client) return failure("Choose a client for this project.", { clientId: ["Client not found"] });

    if (id) {
      // A budget cut must not strand receipts that already exceed it.
      const received = await prisma.receipt.aggregate({
        where: { projectId: id },
        _sum: { amountPaise: true },
      });
      const receivedPaise = received._sum.amountPaise ?? 0n;
      if (budget < receivedPaise) {
        return failure(
          `${formatINR(receivedPaise)} has already been received against this project, so the budget ` +
            `cannot be reduced below that.`,
          { budget: ["Below the amount already collected"] },
        );
      }

      await prisma.project.update({
        where: { id },
        data: { ...rest, budgetPaise: budget, ...billing, ...commission },
      });
      revalidateFinance();
      return success(`${rest.name} updated.`);
    }

    const created = await prisma.project.create({
      data: { ...rest, budgetPaise: budget, ...billing, ...commission },
    });
    revalidateFinance();
    return success(`${rest.name} created.`, created.id);
  });
}

export async function setProjectStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const id = formValue(formData, "id");
    const status = formValue(formData, "status");
    if (!id) return failure("Missing project reference.");
    if (!PROJECT_STATUSES.includes(status as (typeof PROJECT_STATUSES)[number])) {
      return failure("Unknown project status.");
    }

    // Status only affects what is forecast from here on. Receipts, schedules
    // and allocations are untouched.
    const project = await prisma.project.update({
      where: { id },
      data: { status: status as (typeof PROJECT_STATUSES)[number] },
    });

    revalidateFinance();
    return success(`${project.name} moved to ${status.toLowerCase().replace("_", " ")}.`);
  });
}

export async function setProjectArchived(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const id = formValue(formData, "id");
    const archive = formValue(formData, "archive") === "true";
    if (!id) return failure("Missing project reference.");

    const project = await prisma.project.update({
      where: { id },
      data: { archivedAt: archive ? new Date() : null },
    });

    revalidateFinance();
    return success(archive ? `${project.name} archived.` : `${project.name} restored.`);
  });
}

export async function deleteProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:delete");

    const id = formValue(formData, "id");
    if (!id) return failure("Missing project reference.");

    const project = await prisma.project.findUnique({
      where: { id },
      include: { _count: { select: { receipts: true, schedules: true } } },
    });
    if (!project) return failure("That project no longer exists.");

    if (project._count.receipts > 0) {
      return failure(
        `${project.name} has ${project._count.receipts} recorded receipt(s). Archive it instead so the ` +
          "collection history is preserved.",
      );
    }

    await prisma.project.delete({ where: { id } });
    revalidateFinance();
    redirect("/clients");
  });
}
