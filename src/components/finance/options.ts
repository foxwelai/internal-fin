import type { ProjectStatus } from "@/lib/finance/types";

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
