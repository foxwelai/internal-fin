"use server";

import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loanPaymentSchema, loanSchema } from "@/lib/validation/schemas";
import { clampToZero, formatINR } from "@/lib/money";
import { formatDay } from "@/lib/dates";

import {
  failure,
  formValue,
  fromZodError,
  revalidateFinance,
  runAction,
  success,
  type ActionState,
} from "./helpers";

export async function saveLoan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const parsed = loanSchema.safeParse({
      id: formValue(formData, "id") || undefined,
      lender: formValue(formData, "lender"),
      principal: formValue(formData, "principal"),
      interestPercent: formValue(formData, "interestPercent"),
      receivedOn: formValue(formData, "receivedOn"),
      dueDate: formValue(formData, "dueDate"),
      reference: formValue(formData, "reference"),
      notes: formValue(formData, "notes"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const { id, principal, interestPercent, ...rest } = parsed.data;

    if (id) {
      const repaid = await prisma.loanPayment.aggregate({
        where: { loanId: id },
        _sum: { amountPaise: true },
      });
      const repaidPaise = repaid._sum.amountPaise ?? 0n;
      if (principal < repaidPaise) {
        return failure(
          `${formatINR(repaidPaise)} has already been repaid, so the principal cannot be set below that.`,
          { principal: ["Below the amount already repaid"] },
        );
      }
    }

    const data = { ...rest, principalPaise: principal, interestRateBps: interestPercent };

    const loan = id
      ? await prisma.loan.update({ where: { id }, data })
      : await prisma.loan.create({ data });

    revalidateFinance();
    return success(
      id
        ? `${loan.lender} updated.`
        : `${formatINR(principal)} from ${loan.lender} recorded. It moves the cash balance but is not income.`,
      loan.id,
    );
  });
}

export async function recordLoanPayment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const parsed = loanPaymentSchema.safeParse({
      loanId: formValue(formData, "loanId"),
      amount: formValue(formData, "amount"),
      paidOn: formValue(formData, "paidOn"),
      method: formValue(formData, "method"),
      reference: formValue(formData, "reference"),
      notes: formValue(formData, "notes"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const input = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findUnique({
        where: { id: input.loanId },
        include: { payments: { select: { amountPaise: true } } },
      });
      if (!loan) return failure("That loan no longer exists.");

      const repaidPaise = loan.payments.reduce((total, row) => total + row.amountPaise, 0n);
      const outstanding = clampToZero(loan.principalPaise - repaidPaise);

      if (input.amount > outstanding) {
        return failure(
          `${loan.lender} has ${formatINR(outstanding)} outstanding. Raise the principal first if ` +
            "interest has been added to the balance.",
          { amount: ["More than the outstanding balance"] },
        );
      }

      await tx.loanPayment.create({
        data: {
          loanId: loan.id,
          amountPaise: input.amount,
          paidOn: input.paidOn,
          method: input.method,
          reference: input.reference,
          notes: input.notes,
        },
      });

      const stillOwed = outstanding - input.amount;

      // Settling the last rupee closes the loan, so it drops out of the totals
      // without anyone having to remember to mark it.
      if (stillOwed === 0n && loan.status === "ACTIVE") {
        await tx.loan.update({ where: { id: loan.id }, data: { status: "CLOSED" } });
      }

      return success(
        stillOwed > 0n
          ? `${formatINR(input.amount)} repaid — ${formatINR(stillOwed)} still owed to ${loan.lender}.`
          : `${loan.lender} fully repaid and closed.`,
      );
    });

    if (result.status === "success") revalidateFinance();
    return result;
  });
}

export async function setLoanStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const id = formValue(formData, "id");
    const close = formValue(formData, "close") === "true";
    if (!id) return failure("Missing loan reference.");

    const loan = await prisma.loan.update({
      where: { id },
      data: { status: close ? "CLOSED" : "ACTIVE" },
    });

    revalidateFinance();
    return success(
      close
        ? `${loan.lender} marked closed. It no longer counts towards borrowing outstanding.`
        : `${loan.lender} reopened.`,
    );
  });
}

export async function deleteLoanPayment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:delete");

    const id = formValue(formData, "id");
    if (!id) return failure("Missing repayment reference.");

    const payment = await prisma.loanPayment.delete({ where: { id } });
    revalidateFinance();
    return success(
      `Repayment of ${formatINR(payment.amountPaise)} dated ${formatDay(payment.paidOn)} removed.`,
    );
  });
}

export async function deleteLoan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:delete");

    const id = formValue(formData, "id");
    if (!id) return failure("Missing loan reference.");

    const loan = await prisma.loan.findUnique({
      where: { id },
      include: { _count: { select: { payments: true } } },
    });
    if (!loan) return failure("That loan no longer exists.");

    if (loan._count.payments > 0) {
      return failure(
        `${loan.lender} has ${loan._count.payments} recorded repayment(s). Mark it closed instead so ` +
          "the cash history survives.",
      );
    }

    await prisma.loan.delete({ where: { id } });
    revalidateFinance();
    return success(`${loan.lender} deleted.`);
  });
}
