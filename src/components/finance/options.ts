import type {
  BillingType,
  CommissionBasis,
  ProjectStatus,
  RecurringInterval,
} from "@/lib/finance/types";

/**
 * Serialisable shapes handed from server components to the client dialogs.
 * Money crosses this boundary as integer paise in a `number`, which is exact
 * for every amount this business will ever see.
 */

export type ClientOption = {
  id: string;
  name: string;
  archived: boolean;
};

export type ScheduleOption = {
  id: string;
  label: string;
  /** ISO date, "2026-09-25". */
  dueDate: string;
  amountPaise: number;
  outstandingPaise: number;
  overdue: boolean;
};

export type ProjectOption = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  status: ProjectStatus;
  description: string | null;
  notes: string | null;
  startDate: string | null;
  expectedCompletionDate: string | null;
  budgetPaise: number;
  receivedPaise: number;
  remainingPaise: number;
  scheduledOutstandingPaise: number;
  unscheduledPaise: number;
  projectUrl: string | null;

  billingType: BillingType;
  recurringInterval: RecurringInterval | null;
  recurringAmountPaise: number | null;
  /** Recurring price restated per year, for ranking retainers. */
  annualisedRecurringPaise: number;

  commissionBasis: CommissionBasis | null;
  commissionPayee: string | null;
  commissionRateBps: number | null;
  commissionAmountPaise: number | null;
  commissionNotes: string | null;
  commissionDuePaise: number;
  commissionPaidPaise: number;
  commissionOutstandingPaise: number;

  schedules: ScheduleOption[];
};

export type ExpenseOption = {
  id: string;
  name: string;
  categoryLabel: string;
  plannedPaise: number;
  paidPaise: number;
  outstandingPaise: number;
  month: string;
};

/**
 * A ProjectOption already carries everything the edit form needs; this keeps
 * the two in step so a new field cannot be silently dropped on save.
 */
export function toProjectInitial(option: ProjectOption) {
  return {
    id: option.id,
    clientId: option.clientId,
    name: option.name,
    description: option.description,
    budgetPaise: option.budgetPaise,
    status: option.status,
    startDate: option.startDate,
    expectedCompletionDate: option.expectedCompletionDate,
    projectUrl: option.projectUrl,
    notes: option.notes,
    billingType: option.billingType,
    recurringInterval: option.recurringInterval,
    recurringAmountPaise: option.recurringAmountPaise,
    commissionBasis: option.commissionBasis,
    commissionPayee: option.commissionPayee,
    commissionRateBps: option.commissionRateBps,
    commissionAmountPaise: option.commissionAmountPaise,
    commissionNotes: option.commissionNotes,
  };
}
