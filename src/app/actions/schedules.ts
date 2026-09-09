"use server";

import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rescheduleSchema, scheduleSchema } from "@/lib/validation/schemas";
import { clampToZero, formatINR } from "@/lib/money";
import { formatDay, parseDateInput } from "@/lib/dates";

import {
  failure,
  formValue,
  fromZodError,
  revalidateFinance,
  runAction,
  success,
  type ActionState,
} from "./helpers";

export async function saveSchedule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const parsed = scheduleSchema.safeParse({
      id: formValue(formData, "id") || undefined,
      projectId: formValue(formData, "projectId"),
      label: formValue(formData, "label"),
      amount: formValue(formData, "amount"),
      dueDate: formValue(formData, "dueDate"),
      notes: formValue(formData, "notes"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const { id, amount, ...rest } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: rest.projectId },
        include: {
          schedules: { where: { archivedAt: null }, include: { allocations: true } },
          receipts: { select: { amountPaise: true } },
        },
      });
      if (!project) return failure("That project no longer exists.");

      if (id) {
        const existing = project.schedules.find((schedule) => schedule.id === id);
        const allocated = existing?.allocations.reduce((total, row) => total + row.amountPaise, 0n) ?? 0n;
        if (amount < allocated) {
          return failure(
            `${formatINR(allocated)} has already been received against this milestone, so it cannot be ` +
              `reduced below that amount.`,
            { amount: ["Below the amount already received"] },
          );
        }
      }

      // Scheduling more than the contract leaves would guarantee a forecast
      // that can never be collected, so it is refused up front.
      const receivedPaise = project.receipts.reduce((total, row) => total + row.amountPaise, 0n);
      const otherScheduledOutstanding = project.schedules
        .filter((schedule) => schedule.id !== id)
        .reduce((total, schedule) => {
          const allocated = schedule.allocations.reduce((sum, row) => sum + row.amountPaise, 0n);
          return total + clampToZero(schedule.amountPaise - allocated);
        }, 0n);

      const remaining = clampToZero(project.budgetPaise - receivedPaise);
      if (otherScheduledOutstanding + amount > remaining) {
        const headroom = clampToZero(remaining - otherScheduledOutstanding);
        return failure(
          `Only ${formatINR(headroom)} of ${project.name} is left to schedule ` +
            `(budget ${formatINR(project.budgetPaise)}, received ${formatINR(receivedPaise)}, ` +
            `already scheduled ${formatINR(otherScheduledOutstanding)}).`,
          { amount: ["More than the remaining contract balance"] },
        );
      }

      const data = { ...rest, amountPaise: amount };
      const schedule = id
        ? await tx.paymentSchedule.update({ where: { id }, data })
        : await tx.paymentSchedule.create({ data });

      return success(
        `${schedule.label} — ${formatINR(amount)} due ${formatDay(schedule.dueDate)} saved.`,
        schedule.id,
      );
    });

    if (result.status === "success") revalidateFinance();
    return result;
  });
}

/**
 * Move an overdue expectation to a new date. This is the explicit action that
 * brings a carried-forward overdue amount back into a month's forecast — it
 * never happens automatically.
 */
export async function rescheduleSchedule(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const parsed = rescheduleSchema.safeParse({
      id: formValue(formData, "id"),
      dueDate: formValue(formData, "dueDate"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const schedule = await prisma.paymentSchedule.update({
      where: { id: parsed.data.id },
      data: { dueDate: parsed.data.dueDate },
    });

    revalidateFinance();
    return success(`${schedule.label} moved to ${formatDay(parsed.data.dueDate)}.`);
  });
}

/** Bulk variant used by the "reschedule overdue" flow on Payments. */
export async function rescheduleMany(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const dueDate = parseDateInput(formValue(formData, "dueDate"));
    if (!dueDate) return failure("Choose a valid new due date.", { dueDate: ["Invalid date"] });

    const ids = formData.getAll("scheduleId").filter((id): id is string => typeof id === "string");
    if (ids.length === 0) return failure("Select at least one payment to reschedule.");

    const { count } = await prisma.paymentSchedule.updateMany({
      where: { id: { in: ids } },
      data: { dueDate },
    });

    revalidateFinance();
    return success(
      `${count} scheduled payment${count === 1 ? "" : "s"} moved to ${formatDay(dueDate)}.`,
    );
  });
}

export async function deleteSchedule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:delete");

    const id = formValue(formData, "id");
    if (!id) return failure("Missing scheduled payment reference.");

    const schedule = await prisma.paymentSchedule.findUnique({
      where: { id },
      include: { allocations: true },
    });
    if (!schedule) return failure("That scheduled payment no longer exists.");

    if (schedule.allocations.length > 0) {
      const allocated = schedule.allocations.reduce((total, row) => total + row.amountPaise, 0n);
      return failure(
        `${formatINR(allocated)} of received money is matched to "${schedule.label}". Unallocate that ` +
          "receipt first, or edit the amount instead of deleting the line.",
      );
    }

    await prisma.paymentSchedule.delete({ where: { id } });
    revalidateFinance();
    return success(`"${schedule.label}" removed from the schedule.`);
  });
}
