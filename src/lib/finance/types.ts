import type { Paise } from "@/lib/money";
import type { MonthKey } from "@/lib/dates";

/* -------------------------------------------------------------------------- */
/* Domain enums — mirrored from the Prisma schema so the engine stays          */
/* independent of the database layer and can be unit-tested on plain objects.  */
/* -------------------------------------------------------------------------- */

export const PROJECT_STATUSES = ["APPROVED", "PENDING", "ON_HOLD"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const EXPENSE_CATEGORIES = [
  "SALARIES",
  "RENT",
  "SOFTWARE",
  "UTILITIES",
  "MARKETING",
  "FREELANCERS",
  "TRAVEL",
  "MISC",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const PAYMENT_METHODS = [
  "BANK_TRANSFER",
  "UPI",
  "CHEQUE",
  "CASH",
  "CARD",
  "OTHER",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const BILLING_TYPES = ["ONE_TIME", "SUBSCRIPTION"] as const;
export type BillingType = (typeof BILLING_TYPES)[number];

export const RECURRING_INTERVALS = ["MONTHLY", "QUARTERLY", "YEARLY"] as const;
export type RecurringInterval = (typeof RECURRING_INTERVALS)[number];

export const COMMISSION_BASES = ["PERCENT_OF_RECEIVED", "FIXED"] as const;
export type CommissionBasis = (typeof COMMISSION_BASES)[number];

export const LOAN_STATUSES = ["ACTIVE", "CLOSED"] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export const CASH_MOVEMENT_TYPES = [
  "FUNDING",
  "OWNER_CONTRIBUTION",
  "OWNER_WITHDRAWAL",
  "TRANSFER_IN",
  "TRANSFER_OUT",
] as const;
export type CashMovementType = (typeof CASH_MOVEMENT_TYPES)[number];

/** Only APPROVED work is firm enough to forecast against. */
export const FORECASTABLE_STATUSES: readonly ProjectStatus[] = ["APPROVED"];

/** Everything else is potential pipeline, reported separately. */
export const PIPELINE_STATUSES: readonly ProjectStatus[] = ["PENDING", "ON_HOLD"];

/* -------------------------------------------------------------------------- */
/* Engine inputs — plain data, no Prisma types                                 */
/* -------------------------------------------------------------------------- */

export type EngineProject = {
  id: string;
  clientId: string;
  clientName: string;
  name: string;
  status: ProjectStatus;
  budgetPaise: Paise;
  startDate: Date | null;
  expectedCompletionDate: Date | null;
  archivedAt: Date | null;

  billingType: BillingType;
  recurringInterval: RecurringInterval | null;
  recurringAmountPaise: Paise | null;

  commissionBasis: CommissionBasis | null;
  commissionPayee: string | null;
  /** Basis points: 12.5% is 1250. */
  commissionRateBps: number | null;
  commissionAmountPaise: Paise | null;
};

export type EngineCommissionPayment = {
  id: string;
  projectId: string;
  amountPaise: Paise;
  paidOn: Date;
};

export type EngineLoan = {
  id: string;
  lender: string;
  principalPaise: Paise;
  interestRateBps: number | null;
  receivedOn: Date;
  dueDate: Date | null;
  status: LoanStatus;
};

export type EngineLoanPayment = {
  id: string;
  loanId: string;
  amountPaise: Paise;
  paidOn: Date;
};

export type EngineSchedule = {
  id: string;
  projectId: string;
  label: string;
  amountPaise: Paise;
  dueDate: Date;
  notes: string | null;
  archivedAt: Date | null;
};

export type EngineReceipt = {
  id: string;
  projectId: string;
  amountPaise: Paise;
  receivedOn: Date;
  method: PaymentMethod;
  reference: string | null;
};

export type EngineAllocation = {
  receiptId: string;
  scheduleId: string;
  amountPaise: Paise;
};

export type EngineExpense = {
  id: string;
  name: string;
  category: ExpenseCategory;
  plannedPaise: Paise;
  periodYear: number;
  periodMonth: number;
  dueDate: Date | null;
  isRecurring: boolean;
  archivedAt: Date | null;
};

export type EngineExpensePayment = {
  id: string;
  expenseId: string;
  amountPaise: Paise;
  paidOn: Date;
};

export type EngineCashMovement = {
  id: string;
  type: CashMovementType;
  amountPaise: Paise;
  occurredOn: Date;
  label: string;
};

export type OpeningBalance = {
  amountPaise: Paise;
  effectiveDate: Date;
};

export type FinanceDataset = {
  projects: readonly EngineProject[];
  schedules: readonly EngineSchedule[];
  receipts: readonly EngineReceipt[];
  allocations: readonly EngineAllocation[];
  expenses: readonly EngineExpense[];
  expensePayments: readonly EngineExpensePayment[];
  commissionPayments: readonly EngineCommissionPayment[];
  loans: readonly EngineLoan[];
  loanPayments: readonly EngineLoanPayment[];
  cashMovements: readonly EngineCashMovement[];
  openingBalance: OpeningBalance | null;
  /** "Today" in Asia/Kolkata, as a UTC-midnight date. Injected, never read
   *  from the clock inside the engine, so results are reproducible. */
  today: Date;
};

/* -------------------------------------------------------------------------- */
/* Engine outputs                                                              */
/* -------------------------------------------------------------------------- */

export const SCHEDULE_STATES = ["PAID", "PARTIALLY_PAID", "OVERDUE", "UNPAID"] as const;
export type ScheduleState = (typeof SCHEDULE_STATES)[number];

export type ScheduleRollup = {
  schedule: EngineSchedule;
  allocatedPaise: Paise;
  outstandingPaise: Paise;
  state: ScheduleState;
  /** Whole days past the due date; 0 when not yet due. */
  daysOverdue: number;
};

export type ReceiptRollup = {
  receipt: EngineReceipt;
  allocatedPaise: Paise;
  unallocatedPaise: Paise;
};

export type ProjectRollup = {
  project: EngineProject;
  budgetPaise: Paise;
  receivedPaise: Paise;
  /** Budget less everything actually received. Never negative. */
  remainingBalancePaise: Paise;
  /** Unpaid portion of the payment schedule. */
  scheduledOutstandingPaise: Paise;
  /** Remaining balance that has not been put on the schedule yet. */
  unscheduledPaise: Paise;
  unallocatedReceiptsPaise: Paise;
  overduePaise: Paise;
  nextPaymentDate: Date | null;
  nextPaymentPaise: Paise;
  scheduleCount: number;
  receiptCount: number;
  isForecastable: boolean;

  /** What the referrer has earned so far, and what is still owed to them. */
  commissionDuePaise: Paise;
  commissionPaidPaise: Paise;
  commissionOutstandingPaise: Paise;

  /** Recurring price annualised, for comparing subscriptions like for like. */
  annualisedRecurringPaise: Paise;
};

export type LoanRollup = {
  loan: EngineLoan;
  repaidPaise: Paise;
  outstandingPaise: Paise;
  paymentCount: number;
  /** Past its due date with money still owed. */
  isOverdue: boolean;
};

export type LoanTotals = {
  activeCount: number;
  principalPaise: Paise;
  repaidPaise: Paise;
  outstandingPaise: Paise;
  overduePaise: Paise;
};

export type ExpenseRollup = {
  expense: EngineExpense;
  paidPaise: Paise;
  outstandingPaise: Paise;
  state: "PAID" | "PARTIALLY_PAID" | "OVERDUE" | "UNPAID";
  daysOverdue: number;
};

export type OverdueBucket = {
  amountPaise: Paise;
  count: number;
};

export type CategoryBreakdownRow = {
  category: ExpenseCategory;
  plannedPaise: Paise;
  paidPaise: Paise;
  shareOfPlanned: number | null;
};

export type MonthSummary = {
  month: MonthKey;
  /** Money that actually landed, dated inside the month. */
  actualCollectionsPaise: Paise;
  /** Unpaid schedule amounts due inside the month, approved projects only. */
  expectedAdditionalCollectionsPaise: Paise;
  projectedCollectionsPaise: Paise;

  plannedExpensesPaise: Paise;
  /** Expense budget lines settled in the month. */
  expenseOutflowPaise: Paise;
  /** Referral commissions settled in the month — a real cost, not budgeted. */
  commissionOutflowPaise: Paise;
  /** Everything operating that left the account: expenses + commissions. */
  actualCashOutflowPaise: Paise;
  outstandingExpensesPaise: Paise;
  projectedCashOutflowPaise: Paise;

  /** Loan principal received and repayments made — financing, not trading. */
  loanDrawnPaise: Paise;
  loanRepaidPaise: Paise;

  actualSurplusPaise: Paise;
  projectedSurplusPaise: Paise;
  surplusMarginPercent: number | null;

  /** Past due, due date inside the selected month. Part of the forecast. */
  overdueInMonth: OverdueBucket;
  /** Past due from before the selected month. Deliberately excluded from the
   *  forecast until explicitly rescheduled. */
  overdueCarriedForward: OverdueBucket;

  receiptCount: number;
  expenseCount: number;
  /** True when the month holds no receipts, expenses or expense payments. */
  isEmpty: boolean;
};

export type MonthComparison = {
  collectionsDeltaPercent: number | null;
  outflowDeltaPercent: number | null;
  surplusDeltaPaise: Paise;
  previous: MonthSummary;
} | null;

export type PipelineTotals = {
  status: ProjectStatus;
  projectCount: number;
  budgetPaise: Paise;
  receivedPaise: Paise;
  remainingPaise: Paise;
};

export type CashPosition = {
  openingBalancePaise: Paise;
  effectiveDate: Date;
  operatingInflowPaise: Paise;
  operatingOutflowPaise: Paise;
  /** Loan principal in, less repayments out. */
  financingNetPaise: Paise;
  nonOperatingNetPaise: Paise;
  closingBalancePaise: Paise;
  asOf: Date;
};

export type AgeingBucketKey = "current" | "1-30" | "31-60" | "61-90" | "90+";

export type AgeingRow = {
  bucket: AgeingBucketKey;
  label: string;
  amountPaise: Paise;
  count: number;
};

export type ClientTotalsRow = {
  clientId: string;
  clientName: string;
  collectedPaise: Paise;
  outstandingPaise: Paise;
  overduePaise: Paise;
  projectCount: number;
};

export type Insight = {
  id: string;
  tone: "neutral" | "positive" | "warning" | "negative";
  text: string;
  href?: string;
};
