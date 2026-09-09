import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, CalendarPlus, Pencil, Wallet } from "lucide-react";

import { PageHeader, SectionHeading } from "@/components/finance/page-header";
import { MetricCard } from "@/components/finance/metric-card";
import { EmptyState } from "@/components/finance/empty-state";
import { Money } from "@/components/finance/money";
import { ProjectStatusBadge, ScheduleStateBadge } from "@/components/finance/status-badge";
import { ProjectDialog } from "@/components/dialogs/project-dialog";
import { ScheduleDialog } from "@/components/dialogs/schedule-dialog";
import { ReceiptDialog } from "@/components/dialogs/receipt-dialog";
import { ScheduleRowActions } from "@/components/finance/schedule-row-actions";
import { ReceiptRowActions } from "@/components/finance/receipt-row-actions";
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
import { formatDay, formatRelativeDay, toDateInputValue, todayInIST } from "@/lib/dates";
import { percentOf, toWire } from "@/lib/money";
import { loadFinanceIndex } from "@/lib/finance/repository";
import { loadPickerOptions } from "@/lib/finance/view-data";
import { PAYMENT_METHOD_LABELS } from "@/lib/finance/labels";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<Metadata> {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  return { title: project?.name ?? "Project" };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const [viewer, index, { clients: clientOptions, projects: projectOptions }, record] = await Promise.all([
    requireUser(),
    loadFinanceIndex(),
    loadPickerOptions(),
    prisma.project.findUnique({
      where: { id: projectId },
      include: { receipts: { include: { allocations: true } } },
    }),
  ]);

  const rollup = index.projectRollups.get(projectId);
  const option = projectOptions.find((row) => row.id === projectId);
  if (!rollup || !record || !option) notFound();

  const today = toDateInputValue(todayInIST());
  const canWrite = can(viewer.role, "finance:write");
  const project = rollup.project;

  const schedules = (index.schedulesByProjectId.get(projectId) ?? [])
    .map((schedule) => index.scheduleRollups.get(schedule.id))
    .filter((row) => row !== undefined)
    .sort((a, b) => a.schedule.dueDate.getTime() - b.schedule.dueDate.getTime());

  const receipts = [...record.receipts].sort(
    (a, b) => b.receivedOn.getTime() - a.receivedOn.getTime(),
  );

  const collectedShare = percentOf(rollup.receivedPaise, rollup.budgetPaise) ?? 0;
  const scheduledTotal = schedules.reduce((sum, row) => sum + row.schedule.amountPaise, 0n);
  const allocatedTotal = schedules.reduce((sum, row) => sum + row.allocatedPaise, 0n);

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link href={`/clients/${project.clientId}`}>
          <ArrowLeft />
          {project.clientName}
        </Link>
      </Button>

      <PageHeader
        title={project.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <ProjectStatusBadge status={project.status} />
            {project.archivedAt ? <Badge>Archived</Badge> : null}
            {!rollup.isForecastable ? (
              <span className="text-warning">
                Not counted in monthly forecasts — money already received still is.
              </span>
            ) : null}
            {record.description ? <span>{record.description}</span> : null}
          </span>
        }
        actions={
          !canWrite ? null : (
          <>
            <ProjectDialog
              clients={clientOptions}
              initial={{
                id: option.id,
                clientId: option.clientId,
                name: option.name,
                description: option.description,
                budgetPaise: option.budgetPaise,
                status: option.status,
                startDate: option.startDate,
                expectedCompletionDate: option.expectedCompletionDate,
                notes: option.notes,
              }}
            >
              <Button variant="outline" size="sm">
                <Pencil />
                Edit
              </Button>
            </ProjectDialog>
            <ScheduleDialog
              projectId={projectId}
              projectName={project.name}
              availablePaise={option.unscheduledPaise}
              today={today}
            >
              <Button variant="secondary" size="sm">
                <CalendarPlus />
                Add milestone
              </Button>
            </ScheduleDialog>
            <ReceiptDialog projects={[option]} defaultProjectId={projectId} today={today}>
              <Button size="sm">
                <Wallet />
                Record payment
              </Button>
            </ReceiptDialog>
          </>
          )
        }
      />

      {/* ------------------------------ Figures ---------------------------- */}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Agreed budget"
          value={rollup.budgetPaise}
          emphasis
          footnote={
            <>
              {project.startDate ? `Started ${formatDay(project.startDate)}` : "No start date"}
              {project.expectedCompletionDate
                ? ` · due ${formatDay(project.expectedCompletionDate)}`
                : ""}
            </>
          }
        />
        <MetricCard
          label="Total received"
          value={rollup.receivedPaise}
          kind="actual"
          emphasis
          footnote={`${rollup.receiptCount} receipt${rollup.receiptCount === 1 ? "" : "s"} · ${Math.round(collectedShare)}% of budget`}
        />
        <MetricCard
          label="Remaining contract balance"
          value={rollup.remainingBalancePaise}
          emphasis
          footnote="Budget less everything received"
        />
        <MetricCard
          label="Scheduled for collection"
          value={rollup.scheduledOutstandingPaise}
          kind="forecast"
          footnote="Unpaid milestones with a date"
        />
        <MetricCard
          label="Not yet scheduled"
          value={rollup.unscheduledPaise}
          kind="plan"
          tone={rollup.unscheduledPaise > 0n ? "warning" : "default"}
          footnote="Never counted in any monthly forecast"
        />
        <MetricCard
          label="Next payment"
          value={rollup.nextPaymentPaise}
          kind="forecast"
          footnote={
            rollup.nextPaymentDate
              ? `${formatDay(rollup.nextPaymentDate)} · ${formatRelativeDay(rollup.nextPaymentDate, index.today)}`
              : "Nothing outstanding on the schedule"
          }
        />
      </section>

      <div className="rounded-lg border border-border bg-surface-2 px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-[12px]">
          <span className="text-muted-foreground">
            Collected <Money value={rollup.receivedPaise} className="text-[12px]" /> of{" "}
            <Money value={rollup.budgetPaise} className="text-[12px]" />
          </span>
          <span className="font-mono tabular text-faint-foreground">
            {Math.round(collectedShare)}%
          </span>
        </div>
        <Meter value={collectedShare} className="mt-2 h-2" label="Share of budget collected" />
      </div>

      {rollup.unallocatedReceiptsPaise > 0n ? (
        <p className="rounded-lg border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-[13px] leading-relaxed text-warning">
          <Money value={rollup.unallocatedReceiptsPaise} tone="warning" className="text-[13px]" /> of
          money received is not matched to any milestone. It still reduces the remaining contract
          balance — use “Match to schedule” on the receipt to tie it to a milestone.
        </p>
      ) : null}

      {record.notes ? (
        <p className="rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
          {record.notes}
        </p>
      ) : null}

      {/* ----------------------------- Schedule ---------------------------- */}

      <section className="space-y-2.5">
        <SectionHeading
          title="Payment schedule"
          description="What the client is expected to pay, and when. Expectations only — nothing here is income until a receipt is matched to it."
        />
        <Card className="overflow-hidden">
          {schedules.length === 0 ? (
            <EmptyState
              icon={CalendarPlus}
              title="No payment schedule yet"
              description="Break the contract into milestones so the monthly forecast knows when to expect the money."
              action={
                canWrite ? (
                  <ScheduleDialog
                    projectId={projectId}
                    projectName={project.name}
                    availablePaise={option.unscheduledPaise}
                    today={today}
                  >
                    <Button size="sm">Add the first milestone</Button>
                  </ScheduleDialog>
                ) : null
              }
            />
          ) : (
            <TableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Milestone</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((row) => (
                    <TableRow key={row.schedule.id}>
                      <TableCell className="min-w-[12rem]">
                        <span className="text-[13px] font-medium">{row.schedule.label}</span>
                        {row.schedule.notes ? (
                          <span className="block text-[12px] text-faint-foreground">
                            {row.schedule.notes}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="font-mono tabular text-[13px]">
                          {formatDay(row.schedule.dueDate)}
                        </span>
                        {/* Only meaningful while money is still owed — a settled
                            milestone is not "46 days overdue". */}
                        {row.outstandingPaise > 0n ? (
                          <span
                            className={
                              row.state === "OVERDUE"
                                ? "block text-[11px] text-negative"
                                : "block text-[11px] text-faint-foreground"
                            }
                          >
                            {formatRelativeDay(row.schedule.dueDate, index.today)}
                          </span>
                        ) : (
                          <span className="block text-[11px] text-faint-foreground">Settled</span>
                        )}
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
                        <Money value={row.outstandingPaise} className="text-[13px]" />
                      </TableCell>
                      <TableCell>
                        {canWrite ? (
                        <ScheduleRowActions
                          projectId={projectId}
                          projectName={project.name}
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
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="text-[12px] text-muted-foreground">
                      Scheduled total
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={scheduledTotal} className="text-[13px]" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={allocatedTotal} className="text-[13px]" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={rollup.scheduledOutstandingPaise} className="text-[13px]" />
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </TableWrap>
          )}
        </Card>
      </section>

      {/* ----------------------------- Receipts ---------------------------- */}

      <section className="space-y-2.5">
        <SectionHeading
          title="Payment history"
          description="Money that actually arrived. These are the only figures that count as collections."
        />
        <Card className="overflow-hidden">
          {receipts.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No payments received yet"
              description="Record the advance here as soon as it lands — you do not need a schedule first."
              action={
                canWrite ? (
                  <ReceiptDialog projects={[option]} defaultProjectId={projectId} today={today}>
                    <Button size="sm">Record a payment</Button>
                  </ReceiptDialog>
                ) : null
              }
            />
          ) : (
            <TableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Received</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="hidden sm:table-cell">Reference</TableHead>
                    <TableHead>Applied to</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((receipt) => {
                    const allocated = receipt.allocations.reduce(
                      (sum, row) => sum + row.amountPaise,
                      0n,
                    );
                    const unallocated = receipt.amountPaise - allocated;
                    return (
                      <TableRow key={receipt.id}>
                        <TableCell className="whitespace-nowrap font-mono tabular text-[13px]">
                          {formatDay(receipt.receivedOn)}
                        </TableCell>
                        <TableCell className="text-[13px] text-muted-foreground">
                          {PAYMENT_METHOD_LABELS[receipt.method]}
                        </TableCell>
                        <TableCell className="hidden font-mono tabular text-[12px] text-faint-foreground sm:table-cell">
                          {receipt.reference ?? "—"}
                        </TableCell>
                        <TableCell className="text-[12px]">
                          {receipt.allocations.length === 0 ? (
                            <span className="text-warning">Unallocated</span>
                          ) : (
                            <ul className="space-y-0.5">
                              {receipt.allocations.map((allocation) => {
                                const target = index.scheduleRollups.get(allocation.scheduleId);
                                return (
                                  <li key={allocation.id} className="text-muted-foreground">
                                    {target?.schedule.label ?? "Milestone"}{" "}
                                    <Money
                                      value={allocation.amountPaise}
                                      className="text-[12px]"
                                      tone="muted"
                                    />
                                  </li>
                                );
                              })}
                              {unallocated > 0n ? (
                                <li className="text-warning">
                                  <Money
                                    value={unallocated}
                                    tone="warning"
                                    className="text-[12px]"
                                  />{" "}
                                  unallocated
                                </li>
                              ) : null}
                            </ul>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Money value={receipt.amountPaise} className="text-[13px] font-medium" />
                        </TableCell>
                        <TableCell>
                          {canWrite ? (
                          <ReceiptRowActions
                            project={option}
                            today={today}
                            receipt={{
                              id: receipt.id,
                              projectId,
                              amountPaise: toWire(receipt.amountPaise),
                              receivedOn: toDateInputValue(receipt.receivedOn),
                              method: receipt.method,
                              reference: receipt.reference,
                              notes: receipt.notes,
                              allocations: receipt.allocations.map((allocation) => ({
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
                    <TableCell colSpan={4} className="text-[12px] text-muted-foreground">
                      Total received
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={rollup.receivedPaise} className="text-[13px]" />
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </TableWrap>
          )}
        </Card>
      </section>
    </div>
  );
}
