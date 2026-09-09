import Link from "next/link";
import type { Metadata } from "next";
import { CalendarClock, Download, Link2, TriangleAlert, Wallet } from "lucide-react";

import { PageHeader } from "@/components/finance/page-header";
import { MetricCard } from "@/components/finance/metric-card";
import { EmptyState } from "@/components/finance/empty-state";
import { Money } from "@/components/finance/money";
import { ScheduleStateBadge } from "@/components/finance/status-badge";
import { ReceiptDialog } from "@/components/dialogs/receipt-dialog";
import { RescheduleManyDialog } from "@/components/dialogs/reschedule-dialog";
import { AllocateDialog } from "@/components/dialogs/allocate-dialog";
import { ScheduleRowActions } from "@/components/finance/schedule-row-actions";
import { ReceiptRowActions } from "@/components/finance/receipt-row-actions";
import { SearchInput } from "@/components/finance/data-toolbar";
import { Pagination, paginate } from "@/components/finance/pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

import {
  compareDates,
  formatDay,
  formatMonthLabel,
  formatRelativeDay,
  isInMonth,
  monthEndInclusive,
  monthStart,
  toDateInputValue,
  todayInIST,
} from "@/lib/dates";
import { toWire } from "@/lib/money";
import { loadFinanceIndex } from "@/lib/finance/repository";
import { loadPickerOptions } from "@/lib/finance/view-data";
import { forecastableScheduleRollups, summariseMonth } from "@/lib/finance/engine";
import { PAYMENT_METHOD_LABELS } from "@/lib/finance/labels";
import { readParam, resolveMonth, withParams, type SearchParams } from "@/lib/finance/page-helpers";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Payments" };

type View = "scheduled" | "received" | "overdue" | "unallocated";
const VIEWS: { key: View; label: string }[] = [
  { key: "scheduled", label: "Scheduled" },
  { key: "received", label: "Received" },
  { key: "overdue", label: "Overdue" },
  { key: "unallocated", label: "Unallocated" },
];

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const month = resolveMonth(params);
  const monthLabel = formatMonthLabel(month, "long");
  const view = (VIEWS.find((row) => row.key === readParam(params, "view"))?.key ?? "scheduled") as View;
  const query = (readParam(params, "q") ?? "").trim().toLowerCase();
  const page = Number(readParam(params, "page") ?? 1) || 1;

  const [viewer, index, { projects: projectOptions }] = await Promise.all([
    requireUser(),
    loadFinanceIndex(),
    loadPickerOptions(),
  ]);

  const canWrite = can(viewer.role, "finance:write");

  const today = toDateInputValue(todayInIST());
  const summary = summariseMonth(index, month);
  const start = monthStart(month);

  const describe = (projectId: string) => {
    const project = index.projectsById.get(projectId);
    return {
      projectName: project?.name ?? "—",
      clientName: project?.clientName ?? "—",
    };
  };

  const matches = (projectId: string, extra: string) => {
    if (!query) return true;
    const { projectName, clientName } = describe(projectId);
    return `${projectName} ${clientName} ${extra}`.toLowerCase().includes(query);
  };

  /* --------------------------- Row collections --------------------------- */

  const forecastSchedules = forecastableScheduleRollups(index).filter(
    (rollup) => rollup.outstandingPaise > 0n,
  );

  const scheduledRows = forecastSchedules
    .filter((rollup) => isInMonth(rollup.schedule.dueDate, month))
    .filter((rollup) => matches(rollup.schedule.projectId, rollup.schedule.label))
    .sort((a, b) => compareDates(a.schedule.dueDate, b.schedule.dueDate));

  const overdueRows = forecastSchedules
    .filter((rollup) => rollup.state === "OVERDUE")
    .filter((rollup) => matches(rollup.schedule.projectId, rollup.schedule.label))
    .sort((a, b) => compareDates(a.schedule.dueDate, b.schedule.dueDate));

  const overdueThisMonth = overdueRows.filter((rollup) => isInMonth(rollup.schedule.dueDate, month));
  const overdueCarried = overdueRows.filter(
    (rollup) => compareDates(rollup.schedule.dueDate, start) < 0,
  );

  const receiptRows = index.dataset.receipts
    .filter((receipt) => isInMonth(receipt.receivedOn, month))
    .filter((receipt) => matches(receipt.projectId, receipt.reference ?? ""))
    .sort((a, b) => compareDates(b.receivedOn, a.receivedOn));

  const unallocatedRows = [...index.receiptRollups.values()]
    .filter((rollup) => rollup.unallocatedPaise > 0n)
    .filter((rollup) => matches(rollup.receipt.projectId, rollup.receipt.reference ?? ""))
    .sort((a, b) => compareDates(b.receipt.receivedOn, a.receipt.receivedOn));

  const counts: Record<View, number> = {
    scheduled: scheduledRows.length,
    received: receiptRows.length,
    overdue: overdueRows.length,
    unallocated: unallocatedRows.length,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payments"
        description={
          <>
            Expected payments and actual receipts, kept apart. Money only counts as collected when a
            receipt is recorded — a scheduled milestone never does.
          </>
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/api/export/payments${withParams(params, { page: undefined })}`}>
                <Download />
                Export CSV
              </Link>
            </Button>
            {canWrite ? (
              <ReceiptDialog projects={projectOptions} today={today}>
                <Button size="sm">
                  <Wallet />
                  Record payment
                </Button>
              </ReceiptDialog>
            ) : null}
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={`Received in ${formatMonthLabel(month, "compact")}`}
          value={summary.actualCollectionsPaise}
          kind="actual"
          href={`/payments${withParams(params, { view: "received", page: undefined })}`}
          footnote={`${summary.receiptCount} receipt${summary.receiptCount === 1 ? "" : "s"}`}
        />
        <MetricCard
          label="Still expected this month"
          value={summary.expectedAdditionalCollectionsPaise}
          kind="forecast"
          href={`/payments${withParams(params, { view: "scheduled", page: undefined })}`}
        />
        <MetricCard
          label="Overdue, due this month"
          value={summary.overdueInMonth.amountPaise}
          kind="actual"
          tone={summary.overdueInMonth.amountPaise > 0n ? "negative" : "default"}
          href={`/payments${withParams(params, { view: "overdue", page: undefined })}`}
          footnote={`${summary.overdueInMonth.count} payment${summary.overdueInMonth.count === 1 ? "" : "s"}`}
        />
        <MetricCard
          label="Overdue from earlier months"
          value={summary.overdueCarriedForward.amountPaise}
          kind="plan"
          tone={summary.overdueCarriedForward.amountPaise > 0n ? "warning" : "default"}
          href={`/payments${withParams(params, { view: "overdue", page: undefined })}`}
          footnote="Excluded from this month's forecast"
        />
      </section>

      <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
        {VIEWS.map((row) => (
          <Link
            key={row.key}
            href={`/payments${withParams(params, { view: row.key, page: undefined })}`}
            aria-current={view === row.key ? "page" : undefined}
            className={
              view === row.key
                ? "-mb-px shrink-0 border-b-2 border-brand px-3 py-2 text-[13px] font-medium text-foreground"
                : "-mb-px shrink-0 border-b-2 border-transparent px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            }
          >
            {row.label}
            <span className="ml-1.5 font-mono tabular text-[11px] text-faint-foreground">
              {counts[row.key]}
            </span>
          </Link>
        ))}
      </div>

      <SearchInput placeholder="Search by client, project, milestone or reference…" className="sm:max-w-md" />

      {view === "scheduled" ? renderScheduled() : null}
      {view === "received" ? renderReceived() : null}
      {view === "overdue" ? renderOverdue() : null}
      {view === "unallocated" ? renderUnallocated() : null}
    </div>
  );

  /* --------------------------------------------------------------------- */

  function scheduleTable(rows: typeof scheduledRows, caption?: React.ReactNode) {
    const total = rows.reduce((sum, row) => sum + row.outstandingPaise, 0n);
    return (
      <Card className="overflow-hidden">
        {caption}
        <TableWrap>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Milestone</TableHead>
                <TableHead>Client & project</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const { projectName, clientName } = describe(row.schedule.projectId);
                const option = projectOptions.find((item) => item.id === row.schedule.projectId);
                return (
                  <TableRow key={row.schedule.id}>
                    <TableCell className="min-w-[11rem] text-[13px] font-medium">
                      {row.schedule.label}
                    </TableCell>
                    <TableCell className="min-w-[12rem]">
                      <Link
                        href={`/projects/${row.schedule.projectId}`}
                        className="text-[13px] hover:text-brand"
                      >
                        {projectName}
                      </Link>
                      <span className="block text-[12px] text-muted-foreground">{clientName}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="font-mono tabular text-[13px]">
                        {formatDay(row.schedule.dueDate)}
                      </span>
                      <span
                        className={
                          row.state === "OVERDUE"
                            ? "block text-[11px] text-negative"
                            : "block text-[11px] text-faint-foreground"
                        }
                      >
                        {formatRelativeDay(row.schedule.dueDate, index.today)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ScheduleStateBadge state={row.state} daysOverdue={row.daysOverdue} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={row.schedule.amountPaise} className="text-[13px]" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money
                        value={row.allocatedPaise}
                        tone={row.allocatedPaise > 0n ? "positive" : "muted"}
                        className="text-[13px]"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={row.outstandingPaise} className="text-[13px] font-medium" />
                    </TableCell>
                    <TableCell>
                      {option && canWrite ? (
                        <ScheduleRowActions
                          projectId={row.schedule.projectId}
                          projectName={projectName}
                          availablePaise={option.unscheduledPaise}
                          allocatedPaise={toWire(row.allocatedPaise)}
                          today={today}
                          schedule={{
                            id: row.schedule.id,
                            label: row.schedule.label,
                            amountPaise: toWire(row.schedule.amountPaise),
                            dueDate: toDateInputValue(row.schedule.dueDate),
                            notes: row.schedule.notes,
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
                <TableCell colSpan={6} className="text-[12px] text-muted-foreground">
                  Total outstanding
                </TableCell>
                <TableCell className="text-right">
                  <Money value={total} className="text-[13px]" />
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </TableWrap>
      </Card>
    );
  }

  function renderScheduled() {
    if (scheduledRows.length === 0) {
      return (
        <EmptyState
          icon={CalendarClock}
          title={`Nothing further scheduled for ${monthLabel}`}
          description="Only unpaid milestones on approved projects appear here. Pending and on-hold work is deliberately left out of the forecast."
        />
      );
    }
    return scheduleTable(scheduledRows);
  }

  function renderOverdue() {
    if (overdueRows.length === 0) {
      return (
        <EmptyState
          icon={CalendarClock}
          title="Nothing is overdue"
          description="Every scheduled payment on an approved project is still within its due date."
        />
      );
    }

    const carriedTotal = overdueCarried.reduce((sum, row) => sum + row.outstandingPaise, 0n);

    return (
      <div className="space-y-5">
        {overdueCarried.length > 0 ? (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-warning/30 bg-warning-soft px-3.5 py-3">
              <p className="flex max-w-2xl items-start gap-2 text-[13px] leading-relaxed text-warning">
                <TriangleAlert className="mt-px size-4 shrink-0" />
                <span>
                  <Money value={carriedTotal} tone="warning" className="text-[13px]" /> fell due
                  before {monthLabel}. It is held out of every forecast until you give it a realistic
                  new date — nothing rolls forward on its own.
                </span>
              </p>
              {canWrite ? (
              <RescheduleManyDialog
                defaultDate={toDateInputValue(monthEndInclusive(month))}
                rows={overdueCarried.map((row) => ({
                  id: row.schedule.id,
                  label: row.schedule.label,
                  projectName: describe(row.schedule.projectId).projectName,
                  clientName: describe(row.schedule.projectId).clientName,
                  dueDate: formatDay(row.schedule.dueDate),
                  outstandingPaise: toWire(row.outstandingPaise),
                }))}
              >
                <Button size="sm" variant="secondary">
                  <CalendarClock />
                  Reschedule {overdueCarried.length}
                </Button>
              </RescheduleManyDialog>
              ) : null}
            </div>
            {scheduleTable(overdueCarried)}
          </div>
        ) : null}

        {overdueThisMonth.length > 0 ? (
          <div className="space-y-2.5">
            <p className="text-[13px] text-muted-foreground">
              Past due, but dated inside {monthLabel} — these are still part of this month&rsquo;s
              forecast.
            </p>
            {scheduleTable(overdueThisMonth)}
          </div>
        ) : null}
      </div>
    );
  }

  function renderReceived() {
    const view = paginate(receiptRows, page);
    const total = receiptRows.reduce((sum, receipt) => sum + receipt.amountPaise, 0n);

    if (receiptRows.length === 0) {
      return (
        <EmptyState
          icon={Wallet}
          title={`No payments received in ${monthLabel}`}
          description="Record a payment as soon as it lands — that is what moves this month's collections."
          action={
            canWrite ? (
              <ReceiptDialog projects={projectOptions} today={today}>
                <Button size="sm">Record a payment</Button>
              </ReceiptDialog>
            ) : null
          }
        />
      );
    }

    return (
      <Card className="overflow-hidden">
        <TableWrap>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Client & project</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="hidden sm:table-cell">Reference</TableHead>
                <TableHead>Applied to</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.rows.map((receipt) => {
                const rollup = index.receiptRollups.get(receipt.id)!;
                const { projectName, clientName } = describe(receipt.projectId);
                const option = projectOptions.find((item) => item.id === receipt.projectId);
                const allocations = index.dataset.allocations.filter(
                  (allocation) => allocation.receiptId === receipt.id,
                );
                return (
                  <TableRow key={receipt.id}>
                    <TableCell className="whitespace-nowrap font-mono tabular text-[13px]">
                      {formatDay(receipt.receivedOn)}
                    </TableCell>
                    <TableCell className="min-w-[12rem]">
                      <Link
                        href={`/projects/${receipt.projectId}`}
                        className="text-[13px] hover:text-brand"
                      >
                        {projectName}
                      </Link>
                      <span className="block text-[12px] text-muted-foreground">{clientName}</span>
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {PAYMENT_METHOD_LABELS[receipt.method]}
                    </TableCell>
                    <TableCell className="hidden font-mono tabular text-[12px] text-faint-foreground sm:table-cell">
                      {receipt.reference ?? "—"}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {allocations.length === 0 ? (
                        <span className="text-warning">Unallocated</span>
                      ) : (
                        <>
                          {allocations
                            .map(
                              (allocation) =>
                                index.scheduleRollups.get(allocation.scheduleId)?.schedule.label ??
                                "Milestone",
                            )
                            .join(", ")}
                          {rollup.unallocatedPaise > 0n ? (
                            <span className="block text-warning">
                              <Money
                                value={rollup.unallocatedPaise}
                                tone="warning"
                                className="text-[12px]"
                              />{" "}
                              unallocated
                            </span>
                          ) : null}
                        </>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={receipt.amountPaise} className="text-[13px] font-medium" />
                    </TableCell>
                    <TableCell>
                      {option && canWrite ? (
                        <ReceiptRowActions
                          project={option}
                          today={today}
                          receipt={{
                            id: receipt.id,
                            projectId: receipt.projectId,
                            amountPaise: toWire(receipt.amountPaise),
                            receivedOn: toDateInputValue(receipt.receivedOn),
                            method: receipt.method,
                            reference: receipt.reference,
                            notes: null,
                            allocations: allocations.map((allocation) => ({
                              scheduleId: allocation.scheduleId,
                              amountPaise: toWire(allocation.amountPaise),
                            })),
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
                <TableCell colSpan={5} className="text-[12px] text-muted-foreground">
                  Total received in {monthLabel}
                </TableCell>
                <TableCell className="text-right">
                  <Money value={total} className="text-[13px]" />
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </TableWrap>
        <Pagination {...view} basePath="/payments" params={params} noun="receipts" />
      </Card>
    );
  }

  function renderUnallocated() {
    if (unallocatedRows.length === 0) {
      return (
        <EmptyState
          icon={Link2}
          title="Every receipt is matched"
          description="No money is sitting unassigned against a milestone."
        />
      );
    }

    const total = unallocatedRows.reduce((sum, row) => sum + row.unallocatedPaise, 0n);

    return (
      <div className="space-y-3">
        <p className="rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
          <Money value={total} className="text-[13px]" /> of money received is not tied to a
          scheduled payment. It already counts in collections and already reduces the remaining
          contract balance — matching it simply stops the schedule asking for it twice.
        </p>
        <Card className="overflow-hidden">
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received</TableHead>
                  <TableHead>Client & project</TableHead>
                  <TableHead className="hidden sm:table-cell">Reference</TableHead>
                  <TableHead className="text-right">Receipt</TableHead>
                  <TableHead className="text-right">Unallocated</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {unallocatedRows.map((row) => {
                  const { projectName, clientName } = describe(row.receipt.projectId);
                  const option = projectOptions.find((item) => item.id === row.receipt.projectId);
                  const allocations = index.dataset.allocations.filter(
                    (allocation) => allocation.receiptId === row.receipt.id,
                  );
                  return (
                    <TableRow key={row.receipt.id}>
                      <TableCell className="whitespace-nowrap font-mono tabular text-[13px]">
                        {formatDay(row.receipt.receivedOn)}
                      </TableCell>
                      <TableCell className="min-w-[12rem]">
                        <Link
                          href={`/projects/${row.receipt.projectId}`}
                          className="text-[13px] hover:text-brand"
                        >
                          {projectName}
                        </Link>
                        <span className="block text-[12px] text-muted-foreground">{clientName}</span>
                      </TableCell>
                      <TableCell className="hidden font-mono tabular text-[12px] text-faint-foreground sm:table-cell">
                        {row.receipt.reference ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={row.receipt.amountPaise} className="text-[13px]" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money
                          value={row.unallocatedPaise}
                          tone="warning"
                          className="text-[13px] font-medium"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {option && canWrite ? (
                          <AllocateDialog
                            receiptId={row.receipt.id}
                            receiptAmountPaise={toWire(row.receipt.amountPaise)}
                            schedules={option.schedules}
                            existing={allocations.map((allocation) => ({
                              scheduleId: allocation.scheduleId,
                              amountPaise: toWire(allocation.amountPaise),
                            }))}
                          >
                            <Button variant="outline" size="sm">
                              <Link2 />
                              Match
                            </Button>
                          </AllocateDialog>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableWrap>
        </Card>
      </div>
    );
  }
}
