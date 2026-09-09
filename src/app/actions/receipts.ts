"use server";

import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { receiptSchema } from "@/lib/validation/schemas";
import { autoAllocate, checkAllocation, checkReceiptWithinBudget } from "@/lib/finance/engine";
import { clampToZero, formatINR, parseRupeesToPaise, type Paise } from "@/lib/money";

import {
  failure,
  formValue,
  fromZodError,
  revalidateFinance,
  runAction,
  success,
  type ActionState,
} from "./helpers";

const formatMoney = (value: Paise) => formatINR(value);

/**
 * Record money that actually arrived, and match it against the schedule.
 *
 * Everything happens inside one transaction: the budget check, the allocation
 * checks and the writes. A receipt can never end up saved with allocations
 * that do not add up, and two people saving at once cannot between them push a
 * project past its budget.
 */
export async function saveReceipt(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const parsed = receiptSchema.safeParse({
      id: formValue(formData, "id") || undefined,
      projectId: formValue(formData, "projectId"),
      amount: formValue(formData, "amount"),
      receivedOn: formValue(formData, "receivedOn"),
      method: formValue(formData, "method"),
      reference: formValue(formData, "reference"),
      notes: formValue(formData, "notes"),
      autoAllocate: formData.get("autoAllocate"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const input = parsed.data;

    // Manual allocations arrive as `alloc:<scheduleId>` fields.
    const manualAllocations: { scheduleId: string; amountPaise: Paise }[] = [];
    for (const [key, raw] of formData.entries()) {
      if (!key.startsWith("alloc:") || typeof raw !== "string" || raw.trim() === "") continue;
      try {
        const amountPaise = parseRupeesToPaise(raw);
        if (amountPaise > 0n) {
          manualAllocations.push({ scheduleId: key.slice("alloc:".length), amountPaise });
        }
      } catch {
        return failure(`"${raw}" is not a valid allocation amount.`);
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: input.projectId },
        include: {
          schedules: { where: { archivedAt: null }, include: { allocations: true } },
          receipts: { select: { id: true, amountPaise: true } },
        },
      });
      if (!project) return failure("That project no longer exists.");

      /* ---- Guard 1: never collect more than the agreed budget ---- */

      const alreadyReceivedPaise = project.receipts
        .filter((receipt) => receipt.id !== input.id)
        .reduce((total, receipt) => total + receipt.amountPaise, 0n);

      const budgetCheck = checkReceiptWithinBudget({
        budgetPaise: project.budgetPaise,
        alreadyReceivedPaise,
        newAmountPaise: input.amount,
        formatMoney,
      });
      if (!budgetCheck.ok) return failure(budgetCheck.message, { amount: ["Exceeds project budget"] });

      /* ---- Work out this receipt's allocations ---- */

      const outstandingByScheduleId = new Map<string, Paise>();
      for (const schedule of project.schedules) {
        const allocatedElsewhere = schedule.allocations
          .filter((allocation) => allocation.receiptId !== input.id)
          .reduce((total, allocation) => total + allocation.amountPaise, 0n);
        outstandingByScheduleId.set(
          schedule.id,
          clampToZero(schedule.amountPaise - allocatedElsewhere),
        );
      }

      const requested = input.autoAllocate
        ? autoAllocate(
            input.amount,
            project.schedules.map((schedule) => ({
              id: schedule.id,
              dueDate: schedule.dueDate,
              outstandingPaise: outstandingByScheduleId.get(schedule.id) ?? 0n,
            })),
          )
        : manualAllocations;

      /* ---- Guard 2: each allocation fits both sides ---- */

      let unallocatedPaise = input.amount;
      for (const allocation of requested) {
        const schedule = project.schedules.find((row) => row.id === allocation.scheduleId);
        if (!schedule) return failure("One of the scheduled payments no longer exists.");

        const check = checkAllocation({
          allocationPaise: allocation.amountPaise,
          receiptUnallocatedPaise: unallocatedPaise,
          scheduleOutstandingPaise: outstandingByScheduleId.get(schedule.id) ?? 0n,
          scheduleLabel: schedule.label,
          formatMoney,
        });
        if (!check.ok) return failure(check.message);

        unallocatedPaise -= allocation.amountPaise;
      }

      /* ---- Write ---- */

      const data = {
        projectId: input.projectId,
        amountPaise: input.amount,
        receivedOn: input.receivedOn,
        method: input.method,
        reference: input.reference,
        notes: input.notes,
      };

      const receipt = input.id
        ? await tx.receipt.update({ where: { id: input.id }, data })
        : await tx.receipt.create({ data });

      // Replace rather than merge, so editing a receipt cannot leave a stale
      // allocation behind that double counts against a milestone.
      await tx.receiptAllocation.deleteMany({ where: { receiptId: receipt.id } });
      if (requested.length > 0) {
        await tx.receiptAllocation.createMany({
          data: requested.map((allocation) => ({
            receiptId: receipt.id,
            scheduleId: allocation.scheduleId,
            amountPaise: allocation.amountPaise,
          })),
        });
      }

      const note =
        unallocatedPaise > 0n
          ? ` ${formatMoney(unallocatedPaise)} is unallocated and shown on the payments page.`
          : "";

      return success(
        `${formatMoney(input.amount)} recorded against ${project.name}.${note}`,
        receipt.id,
      );
    });

    if (result.status === "success") revalidateFinance();
    return result;
  });
}

/** Match an already-recorded receipt to schedule lines after the fact. */
export async function allocateReceipt(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const receiptId = formValue(formData, "receiptId");
    if (!receiptId) return failure("Missing receipt reference.");

    const allocations: { scheduleId: string; amountPaise: Paise }[] = [];
    for (const [key, raw] of formData.entries()) {
      if (!key.startsWith("alloc:") || typeof raw !== "string" || raw.trim() === "") continue;
      try {
        const amountPaise = parseRupeesToPaise(raw);
        if (amountPaise > 0n) allocations.push({ scheduleId: key.slice("alloc:".length), amountPaise });
      } catch {
        return failure(`"${raw}" is not a valid allocation amount.`);
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.findUnique({
        where: { id: receiptId },
        include: {
          allocations: true,
          project: {
            include: { schedules: { where: { archivedAt: null }, include: { allocations: true } } },
          },
        },
      });
      if (!receipt) return failure("That receipt no longer exists.");

      let unallocatedPaise = receipt.amountPaise;
      for (const allocation of allocations) {
        const schedule = receipt.project.schedules.find((row) => row.id === allocation.scheduleId);
        if (!schedule) return failure("One of the scheduled payments no longer exists.");

        const allocatedElsewhere = schedule.allocations
          .filter((row) => row.receiptId !== receiptId)
          .reduce((total, row) => total + row.amountPaise, 0n);

        const check = checkAllocation({
          allocationPaise: allocation.amountPaise,
          receiptUnallocatedPaise: unallocatedPaise,
          scheduleOutstandingPaise: clampToZero(schedule.amountPaise - allocatedElsewhere),
          scheduleLabel: schedule.label,
          formatMoney,
        });
        if (!check.ok) return failure(check.message);

        unallocatedPaise -= allocation.amountPaise;
      }

      await tx.receiptAllocation.deleteMany({ where: { receiptId } });
      if (allocations.length > 0) {
        await tx.receiptAllocation.createMany({
          data: allocations.map((allocation) => ({
            receiptId,
            scheduleId: allocation.scheduleId,
            amountPaise: allocation.amountPaise,
          })),
        });
      }

      return success(
        unallocatedPaise > 0n
          ? `Allocated. ${formatMoney(unallocatedPaise)} of this receipt remains unallocated.`
          : "Receipt fully allocated.",
      );
    });

    if (result.status === "success") revalidateFinance();
    return result;
  });
}

export async function deleteReceipt(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:delete");

    const id = formValue(formData, "id");
    if (!id) return failure("Missing receipt reference.");

    const receipt = await prisma.receipt.findUnique({ where: { id } });
    if (!receipt) return failure("That receipt no longer exists.");

    // Allocations cascade, which releases the schedule lines it was covering.
    await prisma.receipt.delete({ where: { id } });
    revalidateFinance();
    return success(`Receipt of ${formatMoney(receipt.amountPaise)} deleted.`);
  });
}
