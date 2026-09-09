"use server";

import { z } from "zod";

import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  expensePaymentSchema,
  expenseSchema,
  templateSchema,
} from "@/lib/validation/schemas";
import { clampToZero, formatINR, toWire, type Paise } from "@/lib/money";
import {
  formatMonthKey,
  formatMonthLabel,
  parseDateInput,
  parseMonthKey,
  type MonthKey,
} from "@/lib/dates";
import { duplicateKey, planMonthCopy, planRecurringGeneration } from "@/lib/finance/recurring";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/finance/labels";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/finance/types";

import {
  failure,
  formValue,
  fromZodError,
  revalidateFinance,
  runAction,
  success,
  type ActionState,
} from "./helpers";

export async function saveExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const parsed = expenseSchema.safeParse({
      id: formValue(formData, "id") || undefined,
      name: formValue(formData, "name"),
      category: formValue(formData, "category"),
      planned: formValue(formData, "planned"),
      month: formValue(formData, "month"),
      dueDate: formValue(formData, "dueDate"),
      isRecurring: formData.get("isRecurring"),
      notes: formValue(formData, "notes"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const { id, planned, month, ...rest } = parsed.data;

    if (id) {
      const paid = await prisma.expensePayment.aggregate({
        where: { expenseId: id },
        _sum: { amountPaise: true },
      });
      const paidPaise = paid._sum.amountPaise ?? 0n;
      if (planned < paidPaise) {
        return failure(
          `${formatINR(paidPaise)} has already been paid against this expense, so the budget cannot be ` +
            "set below that.",
          { planned: ["Below the amount already paid"] },
        );
      }
    }

    const data = {
      ...rest,
      plannedPaise: planned,
      periodYear: month.year,
      periodMonth: month.month,
    };

    const expense = id
      ? await prisma.monthlyExpense.update({ where: { id }, data })
      : await prisma.monthlyExpense.create({ data });

    revalidateFinance();
    return success(
      `${expense.name} — ${formatINR(planned)} for ${formatMonthLabel(month, "long")} saved.`,
      expense.id,
    );
  });
}

export async function setExpenseArchived(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const id = formValue(formData, "id");
    const archive = formValue(formData, "archive") === "true";
    if (!id) return failure("Missing expense reference.");

    const expense = await prisma.monthlyExpense.update({
      where: { id },
      data: { archivedAt: archive ? new Date() : null },
    });

    revalidateFinance();
    return success(archive ? `${expense.name} archived.` : `${expense.name} restored.`);
  });
}

export async function deleteExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:delete");

    const id = formValue(formData, "id");
    if (!id) return failure("Missing expense reference.");

    const expense = await prisma.monthlyExpense.findUnique({
      where: { id },
      include: { _count: { select: { payments: true } } },
    });
    if (!expense) return failure("That expense no longer exists.");

    if (expense._count.payments > 0) {
      return failure(
        `${expense.name} has ${expense._count.payments} recorded payment(s). Archive it instead so the ` +
          "cash outflow history stays intact.",
      );
    }

    await prisma.monthlyExpense.delete({ where: { id } });
    revalidateFinance();
    return success(`${expense.name} deleted.`);
  });
}

/**
 * Record cash actually leaving the account. The payment date drives which
 * month's outflow it lands in, independently of which month the expense was
 * budgeted to.
 */
export async function recordExpensePayment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const parsed = expensePaymentSchema.safeParse({
      expenseId: formValue(formData, "expenseId"),
      amount: formValue(formData, "amount"),
      paidOn: formValue(formData, "paidOn"),
      method: formValue(formData, "method"),
      reference: formValue(formData, "reference"),
      notes: formValue(formData, "notes"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const input = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const expense = await tx.monthlyExpense.findUnique({
        where: { id: input.expenseId },
        include: { payments: { select: { amountPaise: true } } },
      });
      if (!expense) return failure("That expense no longer exists.");

      const paidPaise = expense.payments.reduce((total, row) => total + row.amountPaise, 0n);
      const remaining = clampToZero(expense.plannedPaise - paidPaise);

      if (input.amount > remaining) {
        return failure(
          `${expense.name} has ${formatINR(remaining)} left to pay. Raise the planned amount first if ` +
            "the bill came in higher than budgeted.",
          { amount: ["More than the outstanding balance"] },
        );
      }

      await tx.expensePayment.create({
        data: {
          expenseId: expense.id,
          amountPaise: input.amount,
          paidOn: input.paidOn,
          method: input.method,
          reference: input.reference,
          notes: input.notes,
        },
      });

      const stillOwed = remaining - input.amount;
      return success(
        stillOwed > 0n
          ? `${formatINR(input.amount)} paid — ${formatINR(stillOwed)} of ${expense.name} still outstanding.`
          : `${expense.name} fully paid.`,
      );
    });

    if (result.status === "success") revalidateFinance();
    return result;
  });
}

export async function deleteExpensePayment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:delete");

    const id = formValue(formData, "id");
    if (!id) return failure("Missing payment reference.");

    const payment = await prisma.expensePayment.delete({ where: { id } });
    revalidateFinance();
    return success(`Payment of ${formatINR(payment.amountPaise)} removed.`);
  });
}

/* -------------------------------------------------------------------------- */
/* Recurring templates                                                         */
/* -------------------------------------------------------------------------- */

export async function saveTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const parsed = templateSchema.safeParse({
      id: formValue(formData, "id") || undefined,
      name: formValue(formData, "name"),
      category: formValue(formData, "category"),
      amount: formValue(formData, "amount"),
      dueDayOfMonth: formValue(formData, "dueDayOfMonth"),
      isActive: formData.get("isActive"),
      notes: formValue(formData, "notes"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const { id, amount, ...rest } = parsed.data;
    const data = { ...rest, amountPaise: amount };

    // Editing a template deliberately does not touch months already generated
    // from it — history stays as it was budgeted at the time.
    const template = id
      ? await prisma.recurringExpenseTemplate.update({ where: { id }, data })
      : await prisma.recurringExpenseTemplate.create({ data });

    revalidateFinance();
    return success(
      id
        ? `${template.name} template updated. Months already generated are unchanged.`
        : `${template.name} template created.`,
      template.id,
    );
  });
}

export async function deleteTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:delete");

    const id = formValue(formData, "id");
    if (!id) return failure("Missing template reference.");

    const template = await prisma.recurringExpenseTemplate.findUnique({ where: { id } });
    if (!template) return failure("That template no longer exists.");

    // Generated rows survive: the relation is SetNull, so history is kept.
    await prisma.recurringExpenseTemplate.delete({ where: { id } });
    revalidateFinance();
    return success(
      `${template.name} template deleted. Expenses already created from it were kept.`,
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Month generation — preview, then confirm                                    */
/* -------------------------------------------------------------------------- */

export type GenerationPreviewRow = {
  name: string;
  category: ExpenseCategory;
  categoryLabel: string;
  plannedPaise: number;
  dueDate: string | null;
};

export type GenerationPreview = {
  ok: boolean;
  message?: string;
  month: string;
  monthLabel: string;
  create: GenerationPreviewRow[];
  skip: { name: string; reason: string }[];
  totalPaise: number;
};

const SKIP_REASONS: Record<string, string> = {
  "already-generated": "already in this month",
  inactive: "template is inactive",
  "duplicate-name": "an expense with this name already exists",
};

async function buildPlan(mode: "templates" | "copy", month: MonthKey, sourceMonth: MonthKey | null) {
  const existing = await prisma.monthlyExpense.findMany({
    where: { periodYear: month.year, periodMonth: month.month, archivedAt: null },
    select: { name: true, category: true, templateId: true },
  });

  if (mode === "templates") {
    const templates = await prisma.recurringExpenseTemplate.findMany({ orderBy: { name: "asc" } });
    return planRecurringGeneration({
      templates: templates.map((template) => ({
        id: template.id,
        name: template.name,
        category: template.category,
        amountPaise: template.amountPaise,
        dueDayOfMonth: template.dueDayOfMonth,
        isActive: template.isActive,
      })),
      month,
      alreadyGeneratedTemplateIds: new Set(
        existing.map((row) => row.templateId).filter((id): id is string => id !== null),
      ),
    });
  }

  if (!sourceMonth) throw new Error("VALIDATION: Choose a month to copy from.");

  const source = await prisma.monthlyExpense.findMany({
    where: { periodYear: sourceMonth.year, periodMonth: sourceMonth.month, archivedAt: null },
    orderBy: { name: "asc" },
  });

  return planMonthCopy({
    source: source.map((row) => ({
      name: row.name,
      category: row.category,
      plannedPaise: row.plannedPaise,
      dueDate: row.dueDate,
      isRecurring: row.isRecurring,
      templateId: row.templateId,
    })),
    targetMonth: month,
    existing,
  });
}

/** Read-only: what *would* be created. Nothing is written. */
export async function previewMonthGeneration(input: {
  mode: "templates" | "copy";
  month: string;
  sourceMonth?: string;
}): Promise<GenerationPreview> {
  await requirePermission("finance:read");

  const month = parseMonthKey(input.month);
  const sourceMonth = input.sourceMonth ? parseMonthKey(input.sourceMonth) : null;

  const empty = {
    ok: false,
    month: input.month,
    monthLabel: input.month,
    create: [],
    skip: [],
    totalPaise: 0,
  };
  if (!month) return { ...empty, message: "Choose a valid month." };
  if (input.mode === "copy" && !sourceMonth) {
    return { ...empty, message: "Choose a month to copy from." };
  }

  try {
    const plan = await buildPlan(input.mode, month, sourceMonth);
    const total = plan.create.reduce((sum: Paise, row) => sum + row.plannedPaise, 0n);

    return {
      ok: true,
      month: formatMonthKey(month),
      monthLabel: formatMonthLabel(month, "long"),
      create: plan.create.map((row) => ({
        name: row.name,
        category: row.category,
        categoryLabel: EXPENSE_CATEGORY_LABELS[row.category],
        plannedPaise: toWire(row.plannedPaise),
        dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
      })),
      skip: plan.skip.map((row) => ({ name: row.name, reason: SKIP_REASONS[row.reason] ?? row.reason })),
      totalPaise: toWire(total),
    };
  } catch (error) {
    return {
      ...empty,
      message: error instanceof Error ? error.message.replace(/^VALIDATION:\s*/, "") : "Could not build a preview.",
    };
  }
}

/**
 * Applies the plan. Re-derived server-side rather than trusted from the
 * preview, and the unique (templateId, period) constraint means a double
 * submit still cannot create a second copy.
 */
export async function applyMonthGeneration(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const mode = formValue(formData, "mode") === "copy" ? "copy" : "templates";
    const month = parseMonthKey(formValue(formData, "month"));
    const sourceMonth = parseMonthKey(formValue(formData, "sourceMonth"));
    if (!month) return failure("Choose a valid month.");

    const plan = await buildPlan(mode, month, sourceMonth);

    if (plan.create.length === 0) {
      return failure(
        `Nothing to add — ${formatMonthLabel(month, "long")} already has every one of these expenses.`,
      );
    }

    await prisma.monthlyExpense.createMany({
      data: plan.create.map((row) => ({
        name: row.name,
        category: row.category,
        plannedPaise: row.plannedPaise,
        periodYear: month.year,
        periodMonth: month.month,
        dueDate: row.dueDate,
        isRecurring: row.isRecurring,
        templateId: row.templateId,
      })),
      skipDuplicates: true,
    });

    revalidateFinance();
    const skipped = plan.skip.length > 0 ? `, ${plan.skip.length} skipped as already present` : "";
    return success(
      `${plan.create.length} expense${plan.create.length === 1 ? "" : "s"} added to ` +
        `${formatMonthLabel(month, "long")}${skipped}.`,
    );
  });
}

/* -------------------------------------------------------------------------- */
/* CSV import                                                                  */
/* -------------------------------------------------------------------------- */

const importRowSchema = z.object({
  name: z.string().trim().min(1).max(160),
  category: z.enum(EXPENSE_CATEGORIES),
  plannedPaise: z.number().int().min(0),
  dueDate: z.string().trim().nullable(),
  notes: z.string().trim().max(600).nullable(),
});

const importPayloadSchema = z.object({
  month: z.string(),
  rows: z.array(importRowSchema).min(1).max(500),
});

/**
 * Applies an import the browser has already mapped and previewed. The rows are
 * re-validated and re-deduplicated here — the preview is a convenience, not a
 * source of truth.
 */
export async function importExpenses(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    let payload: unknown;
    try {
      payload = JSON.parse(formValue(formData, "payload") || "{}");
    } catch {
      return failure("The import data could not be read. Try selecting the file again.");
    }

    const parsed = importPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return failure("Some rows are not valid. Go back to the preview and fix the highlighted ones.");
    }

    const month = parseMonthKey(parsed.data.month);
    if (!month) return failure("Choose a valid month to import into.");

    const existing = await prisma.monthlyExpense.findMany({
      where: { periodYear: month.year, periodMonth: month.month, archivedAt: null },
      select: { name: true, category: true },
    });
    const seen = new Set(existing.map((row) => duplicateKey(row.name, row.category)));

    const toCreate: {
      name: string;
      category: ExpenseCategory;
      plannedPaise: bigint;
      periodYear: number;
      periodMonth: number;
      dueDate: Date | null;
      notes: string | null;
      isRecurring: boolean;
    }[] = [];
    let skipped = 0;

    for (const row of parsed.data.rows) {
      const key = duplicateKey(row.name, row.category);
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      seen.add(key);
      toCreate.push({
        name: row.name,
        category: row.category,
        plannedPaise: BigInt(row.plannedPaise),
        periodYear: month.year,
        periodMonth: month.month,
        dueDate: parseDateInput(row.dueDate),
        notes: row.notes,
        isRecurring: false,
      });
    }

    if (toCreate.length === 0) {
      return failure(
        `Nothing imported — all ${skipped} row(s) already exist in ${formatMonthLabel(month, "long")}.`,
      );
    }

    await prisma.monthlyExpense.createMany({ data: toCreate });

    revalidateFinance();
    const note = skipped > 0 ? `, ${skipped} skipped as duplicates` : "";
    return success(
      `Imported ${toCreate.length} expense${toCreate.length === 1 ? "" : "s"} into ` +
        `${formatMonthLabel(month, "long")}${note}.`,
    );
  });
}
