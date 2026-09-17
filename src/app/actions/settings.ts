"use server";

import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cashMovementSchema, settingsSchema } from "@/lib/validation/schemas";
import { formatINR } from "@/lib/money";
import { CASH_MOVEMENT_LABELS } from "@/lib/finance/labels";

import {
  failure,
  formValue,
  fromZodError,
  revalidateFinance,
  runAction,
  success,
  type ActionState,
} from "./helpers";

export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("settings:manage");

    const parsed = settingsSchema.safeParse({
      companyName: formValue(formData, "companyName"),
      openingBalance: formValue(formData, "openingBalance"),
      openingBalanceDate: formValue(formData, "openingBalanceDate"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const { companyName, openingBalance, openingBalanceDate } = parsed.data;

    await prisma.appSettings.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        companyName,
        openingBalancePaise: openingBalance,
        openingBalanceDate: openingBalance === null ? null : openingBalanceDate,
        openingBalanceIsDemo: false,
      },
      update: {
        companyName,
        openingBalancePaise: openingBalance,
        openingBalanceDate: openingBalance === null ? null : openingBalanceDate,
        // Once a person edits it, it is theirs, not the demo's.
        openingBalanceIsDemo: false,
      },
    });

    revalidateFinance();
    return success(
      openingBalance === null
        ? "Settings saved. Cash-balance tracking is off until an opening balance is set."
        : `Settings saved. Cash balance now starts from ${formatINR(openingBalance)}.`,
    );
  });
}

export async function saveCashMovement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const parsed = cashMovementSchema.safeParse({
      id: formValue(formData, "id") || undefined,
      type: formValue(formData, "type"),
      label: formValue(formData, "label"),
      amount: formValue(formData, "amount"),
      occurredOn: formValue(formData, "occurredOn"),
      notes: formValue(formData, "notes"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const { id, amount, ...rest } = parsed.data;
    const data = { ...rest, amountPaise: amount };

    const movement = id
      ? await prisma.cashMovement.update({ where: { id }, data })
      : await prisma.cashMovement.create({ data });

    revalidateFinance();
    return success(
      `${CASH_MOVEMENT_LABELS[movement.type]} of ${formatINR(amount)} recorded. ` +
        "Non-operating cash never affects collections or the surplus.",
    );
  });
}

export async function deleteCashMovement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:delete");

    const id = formValue(formData, "id");
    if (!id) return failure("Missing entry reference.");

    const movement = await prisma.cashMovement.delete({ where: { id } });
    revalidateFinance();
    return success(`${movement.label} removed.`);
  });
}
