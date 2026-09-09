import type {
  CashMovementType,
  ExpenseCategory,
  PaymentMethod,
  ProjectStatus,
  ScheduleState,
} from "./types";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  APPROVED: "Approved",
  PENDING: "Pending",
  ON_HOLD: "On Hold",
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  SALARIES: "Salaries",
  RENT: "Office rent",
  SOFTWARE: "Software & AI",
  UTILITIES: "Internet & utilities",
  MARKETING: "Marketing",
  FREELANCERS: "Freelancers",
  TRAVEL: "Travel",
  MISC: "Miscellaneous",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Bank transfer",
  UPI: "UPI",
  CHEQUE: "Cheque",
  CASH: "Cash",
  CARD: "Card",
  OTHER: "Other",
};

export const SCHEDULE_STATE_LABELS: Record<ScheduleState, string> = {
  PAID: "Paid",
  PARTIALLY_PAID: "Partially paid",
  OVERDUE: "Overdue",
  UNPAID: "Unpaid",
};

export const CASH_MOVEMENT_LABELS: Record<CashMovementType, string> = {
  FUNDING: "Funding received",
  OWNER_CONTRIBUTION: "Owner contribution",
  OWNER_WITHDRAWAL: "Owner withdrawal",
  TRANSFER_IN: "Transfer in",
  TRANSFER_OUT: "Transfer out",
};

/** Tighter names for dense contexts — donut legends, narrow table columns. */
export const EXPENSE_CATEGORY_SHORT_LABELS: Record<ExpenseCategory, string> = {
  SALARIES: "Salaries",
  RENT: "Rent",
  SOFTWARE: "Software",
  UTILITIES: "Utilities",
  MARKETING: "Marketing",
  FREELANCERS: "Freelancers",
  TRAVEL: "Travel",
  MISC: "Misc",
};

/** Fixed hues per category so a slice keeps its colour across every chart. */
export const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  SALARIES: "#f4551d",
  RENT: "#e08a3c",
  SOFTWARE: "#5b8def",
  UTILITIES: "#46b881",
  MARKETING: "#c56bd6",
  FREELANCERS: "#4bc0c8",
  TRAVEL: "#d9a441",
  MISC: "#7b8290",
};
