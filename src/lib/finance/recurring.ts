/**
 * Planning helpers for generating a month's expenses.
 *
 * Both planners are pure and return a preview the UI shows before anything is
 * written, which is what makes "generate from templates" and "copy last month"
 * safe to re-run: a row that already exists is reported as skipped rather than
 * duplicated.
 */

import { dayInMonth, type MonthKey } from "@/lib/dates";
import type { Paise } from "@/lib/money";
import type { ExpenseCategory } from "./types";

export type TemplateInput = {
  id: string;
  name: string;
  category: ExpenseCategory;
  amountPaise: Paise;
  dueDayOfMonth: number | null;
  isActive: boolean;
};

export type PlannedExpense = {
  templateId: string | null;
  name: string;
  category: ExpenseCategory;
  plannedPaise: Paise;
  dueDate: Date | null;
  isRecurring: boolean;
};

export type SkippedExpense = {
  name: string;
  reason: "already-generated" | "inactive" | "duplicate-name";
};

export type GenerationPlan = {
  month: MonthKey;
  create: PlannedExpense[];
  skip: SkippedExpense[];
};

/**
 * Idempotent by construction: any template whose id is already present for the
 * target month lands in `skip`, so running generation twice creates nothing
 * the second time. The database backs this up with a unique constraint on
 * (templateId, periodYear, periodMonth).
 */
export function planRecurringGeneration(input: {
  templates: readonly TemplateInput[];
  month: MonthKey;
  alreadyGeneratedTemplateIds: ReadonlySet<string>;
}): GenerationPlan {
  const create: PlannedExpense[] = [];
  const skip: SkippedExpense[] = [];

  for (const template of input.templates) {
    if (!template.isActive) {
      skip.push({ name: template.name, reason: "inactive" });
      continue;
    }
    if (input.alreadyGeneratedTemplateIds.has(template.id)) {
      skip.push({ name: template.name, reason: "already-generated" });
      continue;
    }
    create.push({
      templateId: template.id,
      name: template.name,
      category: template.category,
      // Snapshot of the template's amount today. Editing the template later
      // must not rewrite this row — that is what keeps history stable.
      plannedPaise: template.amountPaise,
      dueDate: template.dueDayOfMonth ? dayInMonth(input.month, template.dueDayOfMonth) : null,
      isRecurring: true,
    });
  }

  return { month: input.month, create, skip };
}

export type CopySourceExpense = {
  name: string;
  category: ExpenseCategory;
  plannedPaise: Paise;
  dueDate: Date | null;
  isRecurring: boolean;
  templateId: string | null;
};

/**
 * Copy a month's budget forward. Matching is on name + category so a second
 * copy does not double the budget; the due day is carried across and clamped
 * to the target month's length.
 */
export function planMonthCopy(input: {
  source: readonly CopySourceExpense[];
  targetMonth: MonthKey;
  existing: readonly { name: string; category: ExpenseCategory; templateId: string | null }[];
}): GenerationPlan {
  const existingKeys = new Set(input.existing.map((row) => duplicateKey(row.name, row.category)));
  const existingTemplateIds = new Set(
    input.existing.map((row) => row.templateId).filter((id): id is string => id !== null),
  );

  const create: PlannedExpense[] = [];
  const skip: SkippedExpense[] = [];

  for (const expense of input.source) {
    if (expense.templateId && existingTemplateIds.has(expense.templateId)) {
      skip.push({ name: expense.name, reason: "already-generated" });
      continue;
    }
    const key = duplicateKey(expense.name, expense.category);
    if (existingKeys.has(key)) {
      skip.push({ name: expense.name, reason: "duplicate-name" });
      continue;
    }
    existingKeys.add(key);

    create.push({
      templateId: expense.templateId,
      name: expense.name,
      category: expense.category,
      plannedPaise: expense.plannedPaise,
      dueDate: expense.dueDate ? dayInMonth(input.targetMonth, expense.dueDate.getUTCDate()) : null,
      isRecurring: expense.isRecurring,
    });
  }

  return { month: input.targetMonth, create, skip };
}

export function duplicateKey(name: string, category: ExpenseCategory): string {
  return `${category}::${name.trim().toLowerCase().replace(/\s+/g, " ")}`;
}
