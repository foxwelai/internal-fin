import type { Metadata } from "next";
import { Banknote, Landmark, Plus } from "lucide-react";

import { PageHeader, SectionHeading } from "@/components/finance/page-header";
import { MetricCard } from "@/components/finance/metric-card";
import { EmptyState } from "@/components/finance/empty-state";
import { Money } from "@/components/finance/money";
import { LoanDialog, LoanPaymentDialog } from "@/components/dialogs/loan-dialog";
import { LoanRowActions } from "@/components/finance/loan-row-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Meter } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrap,
} from "@/components/ui/table";

import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatDay, formatRelativeDay, toDateInputValue, todayInIST } from "@/lib/dates";
import { formatPercent, percentOf, toWire } from "@/lib/money";
import { loadFinanceIndex, loadLoans } from "@/lib/finance/repository";
import { loanTotals } from "@/lib/finance/engine";
import { LOAN_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/finance/labels";

export const metadata: Metadata = { title: "Loans" };

export default async function LoansPage() {
  const [viewer, index, loans] = await Promise.all([
    requireUser(),
    loadFinanceIndex(),
    loadLoans(),
  ]);

  const canWrite = can(viewer.role, "finance:write");
  const today = toDateInputValue(todayInIST());
  const totals = loanTotals(index);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Loans"
        description="Money borrowed by the business. The principal arriving and every repayment move the cash balance — neither is income or expense, so the operating surplus stays a measure of trading."
        actions={
          canWrite ? (
            <LoanDialog today={today}>
              <Button size="sm">
                <Plus />
                Record a loan
              </Button>
            </LoanDialog>
          ) : null
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Outstanding"
          value={totals.outstandingPaise}
          kind="actual"
          emphasis
          tone={totals.outstandingPaise > 0n ? "warning" : "default"}
          footnote={`${totals.activeCount} active loan${totals.activeCount === 1 ? "" : "s"}`}
        />
        <MetricCard
          label="Borrowed to date"
          value={totals.principalPaise}
          kind="neutral"
          emphasis
          footnote="Principal on active loans"
        />
        <MetricCard
          label="Repaid"
          value={totals.repaidPaise}
          kind="actual"
          emphasis
          footnote="Across every loan, active and closed"
        />
        <MetricCard
          label="Past its repay-by date"
          value={totals.overduePaise}
          kind="actual"
          emphasis
          tone={totals.overduePaise > 0n ? "negative" : "default"}
        />
      </section>

      <section className="space-y-2.5">
        <SectionHeading title="Loans" />
        {loans.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="No loans recorded"
            description="Record a working capital line, a term loan or a director's loan, and the cash balance will account for it without touching the operating result."
            action={
              canWrite ? (
                <LoanDialog today={today}>
                  <Button size="sm">Record a loan</Button>
                </LoanDialog>
              ) : null
            }
          />
        ) : (
          <div className="space-y-3">
            {loans.map((loan) => {
              const rollup = index.loanRollups.get(loan.id);
              const repaid = rollup?.repaidPaise ?? 0n;
              const outstanding = rollup?.outstandingPaise ?? loan.principalPaise;
              const repaidShare = percentOf(repaid, loan.principalPaise) ?? 0;
              const isClosed = loan.status === "CLOSED";

              return (
                <Card key={loan.id} className="overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[15px] font-semibold tracking-tight">{loan.lender}</h3>
                        <Badge variant={isClosed ? "default" : rollup?.isOverdue ? "negative" : "positive"}>
                          {rollup?.isOverdue && !isClosed ? "Past due" : LOAN_STATUS_LABELS[loan.status]}
                        </Badge>
                        {loan.isDemo ? <Badge variant="info">Demo</Badge> : null}
                      </div>
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        Received <span className="font-mono tabular">{formatDay(loan.receivedOn)}</span>
                        {loan.interestRateBps ? (
                          <>
                            <span className="mx-1.5 text-faint-foreground">·</span>
                            <span className="font-mono tabular">
                              {formatPercent(loan.interestRateBps / 100)}
                            </span>{" "}
                            a year
                          </>
                        ) : null}
                        {loan.dueDate ? (
                          <>
                            <span className="mx-1.5 text-faint-foreground">·</span>
                            repay by{" "}
                            <span className="font-mono tabular">{formatDay(loan.dueDate)}</span>
                            {outstanding > 0n && !isClosed ? (
                              <span className={rollup?.isOverdue ? "ml-1.5 text-negative" : "ml-1.5 text-faint-foreground"}>
                                {formatRelativeDay(loan.dueDate, index.today)}
                              </span>
                            ) : null}
                          </>
                        ) : null}
                        {loan.reference ? (
                          <>
                            <span className="mx-1.5 text-faint-foreground">·</span>
                            <span className="font-mono tabular">{loan.reference}</span>
                          </>
                        ) : null}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {canWrite && outstanding > 0n ? (
                        <LoanPaymentDialog
                          loanId={loan.id}
                          lender={loan.lender}
                          outstandingPaise={toWire(outstanding)}
                          today={today}
                        >
                          <Button variant="outline" size="sm">
                            <Banknote />
                            Repay
                          </Button>
                        </LoanPaymentDialog>
                      ) : null}
                      {canWrite ? (
                        <LoanRowActions
                          outstandingPaise={toWire(outstanding)}
                          paymentCount={loan.payments.length}
                          isClosed={isClosed}
                          today={today}
                          loan={{
                            id: loan.id,
                            lender: loan.lender,
                            principalPaise: toWire(loan.principalPaise),
                            interestRateBps: loan.interestRateBps,
                            receivedOn: toDateInputValue(loan.receivedOn),
                            dueDate: toDateInputValue(loan.dueDate) || null,
                            reference: loan.reference,
                            notes: loan.notes,
                          }}
                        />
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-3 border-t border-border px-4 py-3.5 sm:grid-cols-3 sm:px-5">
                    <Figure label="Principal" value={loan.principalPaise} />
                    <Figure label="Repaid" value={repaid} tone="positive" />
                    <Figure label="Outstanding" value={outstanding} tone={outstanding > 0n ? "warning" : "muted"} />
                    <div className="sm:col-span-3">
                      <Meter
                        value={repaidShare}
                        className="h-1.5"
                        barClassName="bg-positive"
                        label={`${Math.round(repaidShare)}% repaid`}
                      />
                    </div>
                  </div>

                  {loan.payments.length > 0 ? (
                    <TableWrap className="border-t border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Repaid on</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead className="hidden sm:table-cell">Reference</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loan.payments.map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell className="whitespace-nowrap font-mono tabular text-[13px]">
                                {formatDay(payment.paidOn)}
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
                          ))}
                        </TableBody>
                      </Table>
                    </TableWrap>
                  ) : null}

                  {loan.notes ? (
                    <p className="border-t border-border px-4 py-3 text-[12px] leading-relaxed text-muted-foreground sm:px-5">
                      {loan.notes}
                    </p>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Figure({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: bigint;
  tone?: "default" | "positive" | "warning" | "muted";
}) {
  return (
    <div>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-faint-foreground">
        {label}
      </span>
      <Money value={value} tone={tone} className="mt-0.5 block text-[17px] font-semibold" />
    </div>
  );
}
