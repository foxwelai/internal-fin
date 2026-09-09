import { z } from "zod";

import {
  CASH_MOVEMENT_TYPES,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  PROJECT_STATUSES,
} from "@/lib/finance/types";

import {
  checkboxField,
  dateField,
  idField,
  moneyField,
  monthField,
  optionalDateField,
  optionalMoneyField,
  optionalEmail,
  optionalText,
  requiredText,
} from "./common";

/* -------------------------------- Clients -------------------------------- */

export const clientSchema = z.object({
  id: idField.optional(),
  name: requiredText("Client name", 120),
  contactPerson: optionalText(120),
  email: optionalEmail,
  phone: optionalText(40),
  notes: optionalText(),
});

/* -------------------------------- Projects ------------------------------- */

export const projectSchema = z
  .object({
    id: idField.optional(),
    clientId: idField,
    name: requiredText("Project name", 160),
    description: optionalText(600),
    budget: moneyField("Project budget"),
    status: z.enum(PROJECT_STATUSES),
    startDate: optionalDateField("Start date"),
    expectedCompletionDate: optionalDateField("Expected completion date"),
    notes: optionalText(),
  })
  .refine(
    (value) =>
      !value.startDate ||
      !value.expectedCompletionDate ||
      value.expectedCompletionDate >= value.startDate,
    { message: "Expected completion cannot be before the start date", path: ["expectedCompletionDate"] },
  );

/* --------------------------- Scheduled payments -------------------------- */

export const scheduleSchema = z.object({
  id: idField.optional(),
  projectId: idField,
  label: requiredText("Payment label", 120),
  amount: moneyField("Expected amount"),
  dueDate: dateField("Expected payment date"),
  notes: optionalText(600),
});

export const rescheduleSchema = z.object({
  id: idField,
  dueDate: dateField("New due date"),
});

/* -------------------------------- Receipts ------------------------------- */

/** Allocations arrive as repeated `allocation:<scheduleId>` form fields. */
export const receiptSchema = z.object({
  id: idField.optional(),
  projectId: idField,
  amount: moneyField("Amount received"),
  receivedOn: dateField("Receipt date"),
  method: z.enum(PAYMENT_METHODS),
  reference: optionalText(80),
  notes: optionalText(600),
  autoAllocate: checkboxField,
});

/* -------------------------------- Expenses ------------------------------- */

export const expenseSchema = z.object({
  id: idField.optional(),
  name: requiredText("Expense name", 160),
  category: z.enum(EXPENSE_CATEGORIES),
  planned: moneyField("Planned amount"),
  month: monthField,
  dueDate: optionalDateField("Due date"),
  isRecurring: checkboxField,
  notes: optionalText(600),
});

export const expensePaymentSchema = z.object({
  expenseId: idField,
  amount: moneyField("Amount paid"),
  paidOn: dateField("Payment date"),
  method: z.enum(PAYMENT_METHODS),
  reference: optionalText(80),
  notes: optionalText(600),
});

export const templateSchema = z.object({
  id: idField.optional(),
  name: requiredText("Template name", 160),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: moneyField("Monthly amount"),
  dueDayOfMonth: z
    .string()
    .transform((value, ctx) => {
      if (value.trim() === "") return null;
      const day = Number(value);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        ctx.addIssue({ code: "custom", message: "Due day must be between 1 and 31" });
        return z.NEVER;
      }
      return day;
    }),
  isActive: checkboxField,
  notes: optionalText(600),
});

export const generateMonthSchema = z.object({
  month: monthField,
  mode: z.enum(["templates", "copy"]),
  /** Only used for `copy`. */
  sourceMonth: monthField.optional(),
  confirm: checkboxField,
});

/* ------------------------------ Cash & config ---------------------------- */

export const cashMovementSchema = z.object({
  id: idField.optional(),
  type: z.enum(CASH_MOVEMENT_TYPES),
  label: requiredText("Description", 160),
  amount: moneyField("Amount"),
  occurredOn: dateField("Date"),
  notes: optionalText(600),
});

export const settingsSchema = z
  .object({
    companyName: requiredText("Company name", 120),
    openingBalance: optionalMoneyField("Opening balance"),
    openingBalanceDate: optionalDateField("Opening balance date"),
  })
  .refine((value) => value.openingBalance === null || value.openingBalanceDate !== null, {
    message: "An opening balance needs an effective date so the running balance knows where to start",
    path: ["openingBalanceDate"],
  });

export type ClientInput = z.infer<typeof clientSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type ScheduleInput = z.infer<typeof scheduleSchema>;
export type ReceiptInput = z.infer<typeof receiptSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
