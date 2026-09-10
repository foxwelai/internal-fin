import Link from "next/link";
import type { Metadata } from "next";
import {
  Banknote,
  CopyPlus,
  Download,
  Plus,
  Receipt,
  RefreshCw,
  Repeat,
  Upload,
} from "lucide-react";

import { PageHeader, SectionHeading } from "@/components/finance/page-header";
import { MetricCard } from "@/components/finance/metric-card";
import { EmptyState } from "@/components/finance/empty-state";
import { Money } from "@/components/finance/money";
import { ExpenseDialog } from "@/components/dialogs/expense-dialog";
import { ExpensePaymentDialog } from "@/components/dialogs/expense-payment-dialog";
import { TemplateDialog } from "@/components/dialogs/template-dialog";
import { GenerateMonthDialog } from "@/components/dialogs/generate-month-dialog";
import { ImportExpensesDialog } from "@/components/dialogs/import-expenses-dialog";
import { ExpenseRowActions } from "@/components/finance/expense-row-actions";
import { ExpenseCards } from "@/components/finance/expense-cards";
import { TemplateRowActions } from "@/components/finance/template-row-actions";
import { FilterChips, SearchInput } from "@/components/finance/data-toolbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Meter } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  TableWrap,
} from "@/components/ui/table";

import { prisma } from "@/lib/db";
import {
  addMonths,
  compareDates,
  formatDay,
  formatMonthKey,
  formatMonthLabel,
  formatRelativeDay,
  isInMonth,
  toDateInputValue,
  todayInIST,
} from "@/lib/dates";
import { percentOf, toWire } from "@/lib/money";
import { loadFinanceIndex } from "@/lib/finance/repository";
import { summariseMonth } from "@/lib/finance/engine";
import {
  EXPENSE_CATEGORY_COLORS,
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/finance/labels";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/finance/types";
import { readParam, resolveMonth, withParams, type SearchParams } from "@/lib/finance/page-helpers";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Monthly Expenses" };

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const month = resolveMonth(params);
  const monthParam = formatMonthKey(month);
  const monthLabel = formatMonthLabel(month, "long");
  const previousMonthParam = formatMonthKey(addMonths(month, -1));

  const category = readParam(params, "category") as ExpenseCategory | undefined;
  const stateFilter = readParam(params, "state");
  const query = (readParam(params, "q") ?? "").trim().toLowerCase();

  const [viewer, index, templates, payments] = await Promise.all([
    requireUser(),
    loadFinanceIndex(),
    prisma.recurringExpenseTemplate.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: { _count: { select: { expenses: true } } },
    }),
    prisma.expensePayment.findMany({ orderBy: { paidOn: "desc" } }),
  ]);

  const today = toDateInputValue(todayInIST());
  const canWrite = can(viewer.role, "finance:write");
  const summary = summariseMonth(index, month);

  const monthExpenses = index.dataset.expenses
    .filter(
      (expense) => expense.periodYear === month.year && expense.periodMonth === month.month,
    )
    .map((expense) => index.expenseRollups.get(expense.id))
    .filter((row) => row !== undefined)
    .filter((row) => row.expense.archivedAt === null);

  const filtered = monthExpenses
    .filter((row) => (category ? row.expense.category === category : true))
    .filter((row) => {
      if (stateFilter === "paid") return row.state === "PAID";
      if (stateFilter === "unpaid") return row.outstandingPaise > 0n;
      if (stateFilter === "overdue") return row.state === "OVERDUE";
      return true;
    })
    .filter((row) => (query ? row.expense.name.toLowerCase().includes(query) : true))
    .sort((a, b) =>
      b.expense.plannedPaise > a.expense.plannedPaise
        ? 1
        : b.expense.plannedPaise < a.expense.plannedPaise
          ? -1
          : 0,
    );

  const plannedTotal = filtered.reduce((sum, row) => sum + row.expense.plannedPaise, 0n);
  const paidTotal = filtered.reduce((sum, row) => sum + row.paidPaise, 0n);
  const outstandingTotal = filtered.reduce((sum, row) => sum + row.outstandingPaise, 0n);

  // Payments dated inside this month — including any settling an older budget line.
  const paymentsThisMonth = payments
    .filter((payment) => isInMonth(payment.paidOn, month))
    .map((payment) => {
      const rollup = index.expenseRollups.get(payment.expenseId);
      return { payment, rollup };
    })
    .filter((row) => row.rollup !== undefined)
    .sort((a, b) => compareDates(b.payment.paidOn, a.payment.paidOn));

  const priorMonthPayments = paymentsThisMonth.filter(
    (row) =>
      row.rollup!.expense.periodYear !== month.year ||
      row.rollup!.expense.periodMonth !== month.month,
  );

  const categoryCounts = Object.fromEntries(
    EXPENSE_CATEGORIES.map((value) => [
      value,
      monthExpenses.filter((row) => row.expense.category === value).length,
    ]),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Monthly Expenses"
        description={
          <>
            High-level budget lines for {monthLabel}. What a cost is budgeted to is kept separate
            from when the cash actually left — a payment made this month for an older bill counts
            in this month&rsquo;s outflow.
          </>
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/api/export/expenses${withParams(params, { page: undefined })}`}>
                <Download />
                Export
              </Link>
            </Button>
            {canWrite ? (
            <ImportExpensesDialog
              month={monthParam}
              monthLabel={monthLabel}
              existing={monthExpenses.map((row) => ({
                name: row.expense.name,
                category: row.expense.category,
              }))}
            >
              <Button variant="outline" size="sm">
                <Upload />
                Import
              </Button>
            </ImportExpensesDialog>
            ) : null}
            {canWrite ? (
              <ExpenseDialog month={monthParam}>
                <Button size="sm">
                  <Plus />
                  Add expense
                </Button>
              </ExpenseDialog>
            ) : null}
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Planned this month"
          value={summary.plannedExpensesPaise}
          kind="plan"
          emphasis
          footnote={`${summary.expenseCount} budget line${summary.expenseCount === 1 ? "" : "s"}`}
        />
        <MetricCard
          label="Cash actually paid"
          value={summary.actualCashOutflowPaise}
          kind="actual"
          emphasis
          footnote={`${paymentsThisMonth.length} payment${paymentsThisMonth.length === 1 ? "" : "s"} dated in ${formatMonthLabel(month, "compact")}`}
        />
        <MetricCard
          label="Still to pay"
          value={summary.outstandingExpensesPaise}
          kind="forecast"
          emphasis
          href={`/expenses${withParams(params, { state: "unpaid" })}`}
        />
        <MetricCard
          label="Projected cash outflow"
          value={summary.projectedCashOutflowPaise}
          kind="forecast"
          emphasis
          footnote="Paid + outstanding budget"
        />
      </section>

      {/* ------------------------- Month generation ------------------------ */}

      {canWrite ? (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2/60 px-3.5 py-3">
        <span className="text-[13px] text-muted-foreground">Build {monthLabel} quickly:</span>
        <GenerateMonthDialog
          mode="templates"
          month={monthParam}
          monthLabel={monthLabel}
          defaultSourceMonth={previousMonthParam}
        >
          <Button variant="secondary" size="sm">
            <RefreshCw />
            Generate from templates
          </Button>
        </GenerateMonthDialog>
        <GenerateMonthDialog
          mode="copy"
          month={monthParam}
          monthLabel={monthLabel}
          defaultSourceMonth={previousMonthParam}
        >
          <Button variant="secondary" size="sm">
            <CopyPlus />
            Copy a previous month
          </Button>
        </GenerateMonthDialog>
        <span className="text-[12px] text-faint-foreground">
          Both preview before saving, and never create a duplicate.
        </span>
      </div>
      ) : null}

      {/* ---------------------------- Expenses ----------------------------- */}

      <section className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput placeholder="Search expenses…" className="w-full sm:w-64" />
          <FilterChips
            paramKey="state"
            allLabel="All states"
            options={[
              { value: "unpaid", label: "Unpaid" },
              { value: "overdue", label: "Overdue" },
              { value: "paid", label: "Paid" },
            ]}
          />
        </div>

        <FilterChips
          paramKey="category"
          allLabel="All categories"
          options={EXPENSE_CATEGORIES.filter((value) => categoryCounts[value] > 0).map((value) => ({
            value,
            label: EXPENSE_CATEGORY_LABELS[value],
            count: categoryCounts[value],
          }))}
        />

        <Card className="overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={
                monthExpenses.length === 0
                  ? `No expenses budgeted for ${monthLabel}`
                  : "No expenses match these filters"
              }
              description={
                monthExpenses.length === 0
                  ? "Generate the month from your recurring templates, copy last month, import a CSV, or add lines one at a time."
                  : "Try clearing the category or state filter."
              }
              action={
                monthExpenses.length === 0 && canWrite ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    <GenerateMonthDialog
                      mode="templates"
                      month={monthParam}
                      monthLabel={monthLabel}
                      defaultSourceMonth={previousMonthParam}
                    >
                      <Button size="sm">Generate from templates</Button>
                    </GenerateMonthDialog>
                    <ExpenseDialog month={monthParam}>
                      <Button size="sm" variant="outline">
                        Add one manually
                      </Button>
                    </ExpenseDialog>
                  </div>
                ) : null
              }
            />
          ) : (
            <>
              {/* Phone: a block per expense, so the amounts are never clipped. */}
              <div className="md:hidden">
                <ExpenseCards
                  rows={filtered}
                  today={index.today}
                  renderPay={(row) =>
                    canWrite ? (
                      <ExpensePaymentDialog
                        expenseId={row.expense.id}
                        expenseName={row.expense.name}
                        plannedPaise={toWire(row.expense.plannedPaise)}
                        paidPaise={toWire(row.paidPaise)}
                        today={today}
                      >
                        <Button variant="outline" size="sm">
                          <Banknote />
                          Pay
                        </Button>
                      </ExpensePaymentDialog>
                    ) : null
                  }
                  renderActions={(row) =>
                    canWrite ? (
                      <ExpenseRowActions
                        paidPaise={toWire(row.paidPaise)}
                        paymentCount={payments.filter((p) => p.expenseId === row.expense.id).length}
                        archived={false}
                        today={today}
                        expense={{
                          id: row.expense.id,
                          name: row.expense.name,
                          category: row.expense.category,
                          plannedPaise: toWire(row.expense.plannedPaise),
                          month: monthParam,
                          dueDate: toDateInputValue(row.expense.dueDate) || null,
                          isRecurring: row.expense.isRecurring,
                          notes: null,
                        }}
                      />
                    ) : null
                  }
                />
                <div className="flex items-center justify-between border-t border-border px-4 py-3 text-[13px]">
                  <span className="text-muted-foreground">
                    {filtered.length === monthExpenses.length ? "Month total" : "Filtered total"}
                  </span>
                  <span className="flex items-baseline gap-3">
                    <Money value={paidTotal} tone="positive" className="text-[13px]" />
                    <Money value={plannedTotal} className="text-[14px] font-medium" />
                  </span>
                </div>
              </div>

              <TableWrap className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Expense</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Planned</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="w-24" />
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const paidShare = percentOf(row.paidPaise, row.expense.plannedPaise) ?? 0;
                    const paymentCount = payments.filter(
                      (payment) => payment.expenseId === row.expense.id,
                    ).length;
                    return (
                      <TableRow key={row.expense.id}>
                        <TableCell className="min-w-[12rem]">
                          <span className="text-[13px] font-medium">{row.expense.name}</span>
                          {row.expense.isRecurring ? (
                            <Repeat
                              className="ml-1.5 inline size-3 text-faint-foreground"
                              aria-label="Recurring"
                            />
                          ) : null}
                          <Meter
                            value={paidShare}
                            className="mt-1.5 max-w-[9rem]"
                            barClassName={row.state === "PAID" ? "bg-positive" : "bg-brand"}
                            label={`${Math.round(paidShare)}% paid`}
                          />
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
                            <span
                              aria-hidden
                              className="size-2 rounded-[2px]"
                              style={{
                                backgroundColor: EXPENSE_CATEGORY_COLORS[row.expense.category],
                              }}
                            />
                            {EXPENSE_CATEGORY_LABELS[row.expense.category]}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {row.expense.dueDate ? (
                            <>
                              <span className="font-mono tabular text-[13px]">
                                {formatDay(row.expense.dueDate)}
                              </span>
                              {row.outstandingPaise > 0n ? (
                                <span
                                  className={
                                    row.state === "OVERDUE"
                                      ? "block text-[11px] text-negative"
                                      : "block text-[11px] text-faint-foreground"
                                  }
                                >
                                  {formatRelativeDay(row.expense.dueDate, index.today)}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-[13px] text-faint-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Money value={row.expense.plannedPaise} className="text-[13px]" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Money
                            value={row.paidPaise}
                            tone={row.paidPaise > 0n ? "positive" : "muted"}
                            className="text-[13px]"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Money
                            value={row.outstandingPaise}
                            tone={row.state === "OVERDUE" ? "negative" : "default"}
                            className="text-[13px] font-medium"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {row.outstandingPaise > 0n && canWrite ? (
                            <ExpensePaymentDialog
                              expenseId={row.expense.id}
                              expenseName={row.expense.name}
                              plannedPaise={toWire(row.expense.plannedPaise)}
                              paidPaise={toWire(row.paidPaise)}
                              today={today}
                            >
                              <Button variant="outline" size="sm">
                                <Banknote />
                                Pay
                              </Button>
                            </ExpensePaymentDialog>
                          ) : row.outstandingPaise === 0n ? (
                            <Badge variant="positive">Paid</Badge>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {canWrite ? (
                          <ExpenseRowActions
                            paidPaise={toWire(row.paidPaise)}
                            paymentCount={paymentCount}
                            archived={false}
                            today={today}
                            expense={{
                              id: row.expense.id,
                              name: row.expense.name,
                              category: row.expense.category,
                              plannedPaise: toWire(row.expense.plannedPaise),
                              month: monthParam,
                              dueDate: toDateInputValue(row.expense.dueDate) || null,
                              isRecurring: row.expense.isRecurring,
                              notes: null,
                            }}
                          />
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="text-[12px] text-muted-foreground">
                      {filtered.length === monthExpenses.length ? "Month total" : "Filtered total"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={plannedTotal} className="text-[13px]" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={paidTotal} className="text-[13px]" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={outstandingTotal} className="text-[13px]" />
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableFooter>
              </Table>
              </TableWrap>
            </>
          )}
        </Card>
      </section>

      {/* --------------------------- Cash outflow -------------------------- */}

      <section className="space-y-2.5">
        <SectionHeading
          title={`Cash paid out in ${monthLabel}`}
          description="Dated by when the money left the account, whichever month the expense was budgeted to."
        />
        <Card className="overflow-hidden">
          {paymentsThisMonth.length === 0 ? (
            <EmptyState title="No payments recorded this month" compact />
          ) : (
            <>
              {priorMonthPayments.length > 0 ? (
                <p className="border-b border-border bg-surface-2/60 px-4 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
                  {priorMonthPayments.length} of these settle a budget line from an earlier month.
                  They count in {monthLabel}&rsquo;s cash outflow, and against that earlier
                  month&rsquo;s budget.
                </p>
              ) : null}
              <TableWrap>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paid on</TableHead>
                      <TableHead>Expense</TableHead>
                      <TableHead>Budgeted to</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="hidden sm:table-cell">Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentsThisMonth.map(({ payment, rollup }) => {
                      const belongsToMonth =
                        rollup!.expense.periodYear === month.year &&
                        rollup!.expense.periodMonth === month.month;
                      return (
                        <TableRow key={payment.id}>
                          <TableCell className="whitespace-nowrap font-mono tabular text-[13px]">
                            {formatDay(payment.paidOn)}
                          </TableCell>
                          <TableCell className="text-[13px]">{rollup!.expense.name}</TableCell>
                          <TableCell>
                            {belongsToMonth ? (
                              <span className="text-[13px] text-muted-foreground">{monthLabel}</span>
                            ) : (
                              <Link
                                href={`/expenses?month=${formatMonthKey({
                                  year: rollup!.expense.periodYear,
                                  month: rollup!.expense.periodMonth,
                                })}`}
                                className="text-[13px] text-warning hover:underline"
                              >
                                {formatMonthLabel(
                                  {
                                    year: rollup!.expense.periodYear,
                                    month: rollup!.expense.periodMonth,
                                  },
                                  "short",
                                )}
                              </Link>
                            )}
                          </TableCell>
                          <TableCell className="text-[13px] text-muted-foreground">
                            {PAYMENT_METHOD_LABELS[payment.method]}
                          </TableCell>
                          <TableCell className="hidden font-mono tabular text-[12px] text-faint-foreground sm:table-cell">
                            {payment.reference ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Money value={payment.amountPaise} className="text-[13px]" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={5} className="text-[12px] text-muted-foreground">
                        Total cash out in {monthLabel}
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={summary.actualCashOutflowPaise} className="text-[13px]" />
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </TableWrap>
            </>
          )}
        </Card>
      </section>

      {/* ---------------------------- Templates ---------------------------- */}

      <section className="space-y-2.5">
        <SectionHeading
          title="Recurring templates"
          description="Blueprints for costs that repeat. Editing one never changes a month already generated."
          actions={
            canWrite ? (
              <TemplateDialog>
                <Button variant="outline" size="sm">
                  <Plus />
                  New template
                </Button>
              </TemplateDialog>
            ) : null
          }
        />
        <Card className="overflow-hidden">
          {templates.length === 0 ? (
            <EmptyState
              icon={Repeat}
              title="No recurring templates"
              description="Add templates for salaries, rent and subscriptions, then generate each month in one click."
              action={
                canWrite ? (
                  <TemplateDialog>
                    <Button size="sm">Create a template</Button>
                  </TemplateDialog>
                ) : null
              }
              compact
            />
          ) : (
            <TableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Monthly amount</TableHead>
                    <TableHead>Due day</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Months generated</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="text-[13px] font-medium">{template.name}</TableCell>
                      <TableCell className="text-[13px] text-muted-foreground">
                        {EXPENSE_CATEGORY_LABELS[template.category]}
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={template.amountPaise} className="text-[13px]" />
                      </TableCell>
                      <TableCell className="font-mono tabular text-[13px] text-muted-foreground">
                        {template.dueDayOfMonth ?? "—"}
                      </TableCell>
                      <TableCell>
                        {template.isActive ? (
                          <Badge variant="positive">Active</Badge>
                        ) : (
                          <Badge>Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular text-[13px] text-muted-foreground">
                        {template._count.expenses}
                      </TableCell>
                      <TableCell>
                        {canWrite ? (
                        <TemplateRowActions
                          generatedCount={template._count.expenses}
                          template={{
                            id: template.id,
                            name: template.name,
                            category: template.category,
                            amountPaise: toWire(template.amountPaise),
                            dueDayOfMonth: template.dueDayOfMonth,
                            isActive: template.isActive,
                            notes: template.notes,
                          }}
                        />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </section>
    </div>
  );
}
