import { z } from "zod";

import {
  BILLING_TYPES,
  CASH_MOVEMENT_TYPES,
  COMMISSION_BASES,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  PROJECT_PROGRESSES,
  PROJECT_STATUSES,
  RECURRING_INTERVALS,
  TEAM_MEMBER_KINDS,
} from "@/lib/finance/types";
import { LEAD_QUALITIES, LEAD_SOURCES } from "@/lib/finance/leads";

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
  optionalUrlField,
  requiredText,
} from "./common";

/* -------------------------------- Clients -------------------------------- */

/** A phone number as people type it: "+91 98200 41122", "080-2345 6789". */
const requiredPhone = (label: string) =>
  requiredText(label, 40).refine(
    (value) => (value.match(/\d/g) ?? []).length >= 6 && /^[\d\s+()./-]+$/.test(value),
    `${label} doesn't look like a phone number`,
  );

export const clientSchema = z.object({
  id: idField.optional(),
  name: requiredText("Company name", 120),
  clientName: requiredText("Client name", 120),
  phone: requiredPhone("Client phone"),
  contactPerson: requiredText("Contact person", 120),
  contactPhone: requiredPhone("Contact phone"),
  companyName: optionalText(160),
  website: optionalUrlField("Website"),
  email: optionalEmail,
  notes: optionalText(),
});

/* ---------------------------------- Team --------------------------------- */

export const teamMemberSchema = z.object({
  id: idField.optional(),
  kind: z.enum(TEAM_MEMBER_KINDS),
  name: requiredText("Name", 120),
  phone: requiredPhone("Phone"),
  designation: optionalText(80),
  email: optionalEmail,
});

/* -------------------------------- Projects ------------------------------- */

const percentCompleteField = z.string().transform((value, ctx): number => {
  const trimmed = value.trim().replace(/%$/, "");
  if (trimmed === "") return 0;
  if (!/^\d{1,3}$/.test(trimmed) || Number(trimmed) > 100) {
    ctx.addIssue({ code: "custom", message: "Enter a whole number from 0 to 100" });
    return z.NEVER;
  }
  return Number(trimmed);
});

const optionalIdField = z
  .string()
  .trim()
  .max(64)
  .transform((value) => (value === "" ? null : value));

/** Where the work stands. Completed always means 100%. */
export const progressFields = {
  progress: z.enum(PROJECT_PROGRESSES),
  progressPercent: percentCompleteField,
  progressNotes: optionalText(2000),
};

export const projectProgressSchema = z.object({ id: idField, ...progressFields });

/** Percentages arrive as text like "12.5" and are stored as basis points. */
const percentField = (label: string) =>
  z.string().transform((value, ctx): number | null => {
    const trimmed = value.trim().replace(/%$/, "");
    if (trimmed === "") return null;
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(trimmed)) {
      ctx.addIssue({ code: "custom", message: `${label} must be a percentage, e.g. 12.5` });
      return z.NEVER;
    }
    const bps = Math.round(Number(trimmed) * 100);
    if (bps <= 0 || bps > 10_000) {
      ctx.addIssue({ code: "custom", message: `${label} must be between 0 and 100` });
      return z.NEVER;
    }
    return bps;
  });

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
    projectUrl: optionalUrlField("Project link"),
    notes: optionalText(),

    billingType: z.enum(BILLING_TYPES),
    recurringInterval: z
      .union([z.enum(RECURRING_INTERVALS), z.literal("")])
      .transform((value) => (value === "" ? null : value)),
    recurringAmount: optionalMoneyField("Recurring amount"),

    commissionBasis: z
      .union([z.enum(COMMISSION_BASES), z.literal("")])
      .transform((value) => (value === "" ? null : value)),
    commissionPayee: optionalText(160),
    commissionPercent: percentField("Commission rate"),
    commissionAmount: optionalMoneyField("Commission amount"),
    commissionNotes: optionalText(600),

    coordinatorId: optionalIdField,
    ...progressFields,
  })
  .refine(
    (value) =>
      !value.startDate ||
      !value.expectedCompletionDate ||
      value.expectedCompletionDate >= value.startDate,
    { message: "Expected completion cannot be before the start date", path: ["expectedCompletionDate"] },
  )
  .refine(
    (value) =>
      value.billingType !== "SUBSCRIPTION" ||
      (value.recurringInterval !== null && value.recurringAmount !== null),
    {
      message: "A subscription needs a recurring amount and how often it renews",
      path: ["recurringAmount"],
    },
  )
  .refine(
    (value) => value.commissionBasis !== "PERCENT_OF_RECEIVED" || value.commissionPercent !== null,
    { message: "Enter the commission rate", path: ["commissionPercent"] },
  )
  .refine((value) => value.commissionBasis !== "FIXED" || value.commissionAmount !== null, {
    message: "Enter the commission amount",
    path: ["commissionAmount"],
  });

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

export const commissionPaymentSchema = z.object({
  projectId: idField,
  amount: moneyField("Amount paid"),
  paidOn: dateField("Payment date"),
  method: z.enum(PAYMENT_METHODS),
  reference: optionalText(80),
  notes: optionalText(600),
});

export const loanSchema = z.object({
  id: idField.optional(),
  lender: requiredText("Lender", 160),
  principal: moneyField("Principal"),
  interestPercent: z
    .string()
    .transform((value, ctx): number | null => {
      const trimmed = value.trim().replace(/%$/, "");
      if (trimmed === "") return null;
      if (!/^\d{1,3}(\.\d{1,2})?$/.test(trimmed)) {
        ctx.addIssue({ code: "custom", message: "Interest rate must be a percentage, e.g. 12.5" });
        return z.NEVER;
      }
      return Math.round(Number(trimmed) * 100);
    }),
  receivedOn: dateField("Date received"),
  dueDate: optionalDateField("Repay by"),
  reference: optionalText(80),
  notes: optionalText(600),
});

export const loanPaymentSchema = z.object({
  loanId: idField,
  amount: moneyField("Repayment amount"),
  paidOn: dateField("Payment date"),
  method: z.enum(PAYMENT_METHODS),
  reference: optionalText(80),
  notes: optionalText(600),
});

/* --------------------------------- Assets -------------------------------- */

export const assetSchema = z
  .object({
    id: idField.optional(),
    name: requiredText("Asset name", 160),
    /** An existing category's id, or "new" alongside `newCategory`. */
    categoryId: z.string().trim().max(64),
    newCategory: optionalText(60),
    specification: optionalText(2000),
    serialNumber: optionalText(120),
    purchasedOn: optionalDateField("Purchase date"),
    cost: optionalMoneyField("Cost"),
    notes: optionalText(),
  })
  .refine((value) => (value.categoryId !== "" && value.categoryId !== "new") || value.newCategory !== null, {
    message: "Choose a category, or name a new one",
    path: ["categoryId"],
  });

/* ---------------------------------- Leads -------------------------------- */

/** Leads being worked or dropped. Winning goes through conversion instead. */
export const EDITABLE_LEAD_STAGES = ["JUST_SPOKE", "IN_PROCESS", "LOST"] as const;

const optionalPhone = (label: string) =>
  z.string().transform((value, ctx): string | null => {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const checked = requiredPhone(label).safeParse(trimmed);
    if (!checked.success) {
      ctx.addIssue({ code: "custom", message: checked.error.issues[0]?.message ?? `Check the ${label.toLowerCase()}` });
      return z.NEVER;
    }
    return checked.data;
  });

const optionalMonthField = z.string().transform((value, ctx): Date | null => {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const match = /^(\d{4})-(\d{2})$/.exec(trimmed);
  const month = match ? Number(match[2]) : 0;
  if (!match || month < 1 || month > 12) {
    ctx.addIssue({ code: "custom", message: "Pick a month, e.g. 2026-10" });
    return z.NEVER;
  }
  return new Date(Date.UTC(Number(match[1]), month - 1, 1));
});

export const leadSchema = z.object({
  id: idField.optional(),
  name: requiredText("Company name", 120),
  clientName: requiredText("Client name", 120),
  phone: requiredPhone("Client phone"),
  contactPerson: optionalText(120),
  contactPhone: optionalPhone("Contact phone"),
  email: optionalEmail,
  website: optionalUrlField("Website"),
  stage: z.enum(EDITABLE_LEAD_STAGES),
  quality: z.enum(LEAD_QUALITIES),
  source: z
    .union([z.enum(LEAD_SOURCES), z.literal("")])
    .transform((value) => (value === "" ? null : value)),
  expectedValue: optionalMoneyField("Expected value"),
  expectedCloseMonth: optionalMonthField,
  requirement: optionalText(2000),
  ownerId: z
    .string()
    .trim()
    .max(64)
    .transform((value) => (value === "" ? null : value)),
  nextFollowUpOn: optionalDateField("Next follow-up"),
  lostReason: optionalText(600),
  notes: optionalText(),
});
