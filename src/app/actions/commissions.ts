"use server";

import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { commissionPaymentSchema } from "@/lib/validation/schemas";
import { clampToZero, formatINR } from "@/lib/money";
import { commissionDueOn } from "@/lib/finance/engine";

import {
  failure,
  formValue,
  fromZodError,
  revalidateFinance,
  runAction,
  success,
  type ActionState,
} from "./helpers";

/**
 * Pay the person who brought the project in. The ceiling is what they have
 * actually earned — a percentage of money collected, or the agreed flat fee —
 * so a referrer can never be paid ahead of the client paying you.
 */
export async function recordCommissionPayment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const parsed = commissionPaymentSchema.safeParse({
      projectId: formValue(formData, "projectId"),
      amount: formValue(formData, "amount"),
      paidOn: formValue(formData, "paidOn"),
      method: formValue(formData, "method"),
      reference: formValue(formData, "reference"),
      notes: formValue(formData, "notes"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const input = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: input.projectId },
        include: {
          receipts: { select: { amountPaise: true } },
          commissionPayments: { select: { amountPaise: true } },
          client: { select: { name: true } },
        },
      });
      if (!project) return failure("That project no longer exists.");
      if (!project.commissionBasis) {
        return failure("No referral commission is agreed on this project.");
      }

      const receivedPaise = project.receipts.reduce((total, row) => total + row.amountPaise, 0n);
      const duePaise = commissionDueOn(
        {
          id: project.id,
          clientId: project.clientId,
          clientName: project.client.name,
          name: project.name,
          status: project.status,
          budgetPaise: project.budgetPaise,
          startDate: project.startDate,
          expectedCompletionDate: project.expectedCompletionDate,
          archivedAt: project.archivedAt,
          billingType: project.billingType,
          recurringInterval: project.recurringInterval,
          recurringAmountPaise: project.recurringAmountPaise,
          commissionBasis: project.commissionBasis,
          commissionPayee: project.commissionPayee,
          commissionRateBps: project.commissionRateBps,
          commissionAmountPaise: project.commissionAmountPaise,
        },
        receivedPaise,
      );

      const paidPaise = project.commissionPayments.reduce(
        (total, row) => total + row.amountPaise,
        0n,
      );
      const outstanding = clampToZero(duePaise - paidPaise);

      if (input.amount > outstanding) {
        return failure(
          `Only ${formatINR(outstanding)} of commission has been earned so far on ${project.name} ` +
            `(${formatINR(duePaise)} earned, ${formatINR(paidPaise)} already paid). Commission accrues ` +
            "as the client pays.",
          { amount: ["More than has been earned"] },
        );
      }

      await tx.commissionPayment.create({
        data: {
          projectId: project.id,
          amountPaise: input.amount,
          paidOn: input.paidOn,
          method: input.method,
          reference: input.reference,
          notes: input.notes,
        },
      });

      const stillOwed = outstanding - input.amount;
      return success(
        stillOwed > 0n
          ? `${formatINR(input.amount)} paid to ${project.commissionPayee ?? "the referrer"} — ${formatINR(stillOwed)} still owed.`
          : `Commission on ${project.name} settled in full.`,
      );
    });

    if (result.status === "success") revalidateFinance();
    return result;
  });
}

export async function deleteCommissionPayment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:delete");

    const id = formValue(formData, "id");
    if (!id) return failure("Missing payment reference.");

    const payment = await prisma.commissionPayment.delete({ where: { id } });
    revalidateFinance();
    return success(`Commission payment of ${formatINR(payment.amountPaise)} removed.`);
  });
}
