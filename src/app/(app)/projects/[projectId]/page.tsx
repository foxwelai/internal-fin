import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  CalendarPlus,
  Gauge,
  HandCoins,
  MessageSquareHeart,
  Star,
  Link as LinkIcon,
  Pencil,
  Wallet,
} from "lucide-react";

import { PageHeader, SectionHeading } from "@/components/finance/page-header";
import { MetricCard } from "@/components/finance/metric-card";
import { EmptyState } from "@/components/finance/empty-state";
import { Money } from "@/components/finance/money";
import {
  ProjectProgressBadge,
  ProjectStatusBadge,
  ScheduleStateBadge,
} from "@/components/finance/status-badge";
import {
  MarkCompletedButton,
  ProjectProgressDialog,
} from "@/components/dialogs/project-progress-dialog";
import { ProjectDialog } from "@/components/dialogs/project-dialog";
import { ScheduleDialog } from "@/components/dialogs/schedule-dialog";
import { ReceiptDialog } from "@/components/dialogs/receipt-dialog";
import { ScheduleRowActions } from "@/components/finance/schedule-row-actions";
import { ReceiptRowActions } from "@/components/finance/receipt-row-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { toProjectInitial } from "@/components/finance/options";
import { PAYMENT_METHOD_LABELS, RECURRING_INTERVAL_SHORT } from "@/lib/finance/labels";
import { CommissionPaymentDialog } from "@/components/dialogs/commission-payment-dialog";
import { ReviewRequestDialog } from "@/components/dialogs/review-request-dialog";
import { ReviewItemActions } from "@/components/finance/review-item-actions";
import { getCurrentUser, requirePageUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<Metadata> {
  const { projectId } = await params;
  // Metadata renders on its own and lands in <title>, so it checks access too.
  if (!(await getCurrentUser())) return { title: "Project" };
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  return { title: project?.name ?? "Project" };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const viewer = await requirePageUser();
  const [index, { clients: clientOptions, projects: projectOptions }, record] = await Promise.all([
    loadFinanceIndex(),
    loadPickerOptions(),
    prisma.project.findUnique({
      where: { id: projectId },
      include: {
        receipts: { include: { allocations: true } },
        coordinator: true,
        client: true,
        reviews: {
          orderBy: { requestedAt: "desc" },
          include: { requestedBy: { select: { name: true } } },
        },
        commissionPayments: { orderBy: { paidOn: "desc" } },
      },
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

  const commissionPayments = record.commissionPayments;
  const receipts = [...record.receipts].sort(
    (a, b) => b.receivedOn.getTime() - a.receivedOn.getTime(),
  );

  const collectedShare = percentOf(rollup.receivedPaise, rollup.budgetPaise) ?? 0;
  const canDelete = can(viewer.role, "finance:delete");
  const now = new Date();
  const submittedReviews = record.reviews.filter((review) => review.submittedAt !== null);
  const openLinks = record.reviews.filter(
    (review) => review.submittedAt === null && review.revokedAt === null && review.expiresAt > now,
  );
  const averageRating =
    submittedReviews.length > 0
      ? submittedReviews.reduce((sum, review) => sum + (review.rating ?? 0), 0) / submittedReviews.length
      : null;
  const reviewContacts = {
    companyName: record.client.name,
    clientName: record.client.clientName,
    clientPhone: record.client.phone,
    contactPerson: record.client.contactPerson,
    contactPhone: record.client.contactPhone,
    email: record.client.email,
  };
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
            {option.billingType === "SUBSCRIPTION" &&
            option.recurringAmountPaise !== null &&
            option.recurringInterval !== null ? (
              <Badge variant="info">
                <Money value={BigInt(option.recurringAmountPaise)} className="text-[11px]" />
                {RECURRING_INTERVAL_SHORT[option.recurringInterval]}
              </Badge>
            ) : null}
            {record.projectUrl ? (
              <a
                href={record.projectUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-brand hover:underline"
              >
                <LinkIcon className="size-3.5" />
                {record.projectUrl.replace(/^https?:\/\//, "")}
              </a>
            ) : null}
            {record.description ? <span>{record.description}</span> : null}
          </span>
        }
        actions={
          !canWrite ? null : (
          <>
            <ProjectDialog
              clients={clientOptions}
              initial={toProjectInitial(option)}
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
            <ReviewRequestDialog project={{ id: projectId, name: project.name }} contacts={reviewContacts}>
              <Button variant="secondary" size="sm">
                <MessageSquareHeart />
                Review link
              </Button>
            </ReviewRequestDialog>
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

      {/* ------------------------------ Delivery --------------------------- */}

      <Card>
        <CardContent className="grid gap-5 p-4 sm:p-5 md:grid-cols-[1fr_16rem]">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-faint-foreground">
                  Delivery
                </span>
                <ProjectProgressBadge progress={record.progress} />
              </div>
              {canWrite ? (
                <div className="flex flex-wrap gap-2">
                  <ProjectProgressDialog
                    project={{
                      id: projectId,
                      name: project.name,
                      progress: record.progress,
                      progressPercent: record.progressPercent,
                      progressNotes: record.progressNotes,
                    }}
                  >
                    <Button size="sm" variant="outline">
                      <Gauge />
                      Update progress
                    </Button>
                  </ProjectProgressDialog>
                  {record.progress !== "COMPLETED" ? (
                    <MarkCompletedButton projectId={projectId} />
                  ) : null}
                </div>
              ) : null}
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono tabular text-[26px] font-semibold leading-8">
                  {record.progressPercent}%
                </span>
                <span className="text-right text-[12px] text-muted-foreground">
                  {record.progress === "COMPLETED" && record.completedOn
                    ? `Completed ${formatDay(record.completedOn)}`
                    : project.expectedCompletionDate
                      ? `Due ${formatDay(project.expectedCompletionDate)} · ${formatRelativeDay(project.expectedCompletionDate, todayInIST())}`
                      : "No due date set"}
                </span>
              </div>
              <Meter
                value={record.progressPercent}
                className="mt-2 h-2"
                barClassName={record.progress === "COMPLETED" ? "bg-positive" : "bg-info"}
                label={`${record.progressPercent}% complete`}
              />
            </div>

            <div>
              <p className="text-[12px] font-medium text-muted-foreground">What&rsquo;s completed</p>
              <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed">
                {record.progressNotes ?? (
                  <span className="text-faint-foreground">Nothing noted yet.</span>
                )}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-2/60 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-faint-foreground">
              Foxwel coordinator
            </p>
            {record.coordinator ? (
              <div className="mt-2 space-y-0.5 text-[13px]">
                <p className="font-medium">
                  {record.coordinator.name}
                  {record.coordinator.isActive ? null : (
                    <span className="ml-2 text-[11px] font-normal text-faint-foreground">(left)</span>
                  )}
                </p>
                {record.coordinator.designation ? (
                  <p className="text-muted-foreground">{record.coordinator.designation}</p>
                ) : null}
                {record.coordinator.phone ? (
                  <a
                    href={`tel:${record.coordinator.phone.replace(/[^\d+]/g, "")}`}
                    className="block font-mono tabular text-brand hover:underline"
                  >
                    {record.coordinator.phone}
                  </a>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-[13px] text-faint-foreground">
                Not assigned{canWrite ? " — pick someone under Edit." : "."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

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

      {/* ---------------------------- Commission --------------------------- */}

      {option.commissionBasis ? (
        <section className="space-y-2.5">
          <SectionHeading
            title="Referral commission"
            description={
              option.commissionBasis === "PERCENT_OF_RECEIVED"
                ? "Accrues as the client pays, so nothing is owed on an unpaid invoice."
                : "A flat fee agreed up front, however much is collected."
            }
          />
          <Card>
            <CardContent className="pt-4 sm:pt-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[13px] text-muted-foreground">
                    Payable to{" "}
                    <span className="text-foreground">{option.commissionPayee ?? "the referrer"}</span>
                    {option.commissionBasis === "PERCENT_OF_RECEIVED" ? (
                      <>
                        {" "}
                        at{" "}
                        <span className="font-mono tabular text-foreground">
                          {(option.commissionRateBps ?? 0) / 100}%
                        </span>{" "}
                        of money collected
                      </>
                    ) : null}
                  </p>
                  {option.commissionNotes ? (
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                      {option.commissionNotes}
                    </p>
                  ) : null}
                </div>
                {canWrite && option.commissionOutstandingPaise > 0 ? (
                  <CommissionPaymentDialog
                    projectId={projectId}
                    payee={option.commissionPayee}
                    duePaise={option.commissionDuePaise}
                    paidPaise={option.commissionPaidPaise}
                    today={today}
                  >
                    <Button size="sm" variant="secondary">
                      <HandCoins />
                      Pay commission
                    </Button>
                  </CommissionPaymentDialog>
                ) : null}
              </div>

              <dl className="mt-4 grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
                <CommissionFigure label="Earned so far" value={BigInt(option.commissionDuePaise)} />
                <CommissionFigure
                  label="Paid"
                  value={BigInt(option.commissionPaidPaise)}
                  tone="positive"
                />
                <CommissionFigure
                  label="Owed"
                  value={BigInt(option.commissionOutstandingPaise)}
                  tone={option.commissionOutstandingPaise > 0 ? "warning" : "muted"}
                />
              </dl>

              {commissionPayments.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t border-border pt-3">
                  {commissionPayments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex items-baseline justify-between gap-3 text-[12px]"
                    >
                      <span className="text-muted-foreground">
                        <span className="font-mono tabular">{formatDay(payment.paidOn)}</span>
                        <span className="mx-1.5 text-faint-foreground">·</span>
                        {PAYMENT_METHOD_LABELS[payment.method]}
                        {payment.reference ? (
                          <span className="ml-1.5 font-mono tabular text-faint-foreground">
                            {payment.reference}
                          </span>
                        ) : null}
                      </span>
                      <Money value={payment.amountPaise} className="text-[12px]" />
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        </section>
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

      {/* --------------------------- Client reviews ------------------------ */}

      <section id="reviews" className="scroll-mt-20 space-y-2.5">
        <SectionHeading
          title="Client reviews"
          description={
            averageRating !== null ? (
              <span className="inline-flex items-center gap-1.5">
                <Star className="size-3.5 fill-brand text-brand" />
                <span className="font-mono tabular text-foreground">{averageRating.toFixed(1)}</span>
                from {submittedReviews.length} review{submittedReviews.length === 1 ? "" : "s"}
              </span>
            ) : (
              "Send the client a link; what they write lands here."
            )
          }
          actions={
            canWrite ? (
              <ReviewRequestDialog project={{ id: projectId, name: project.name }} contacts={reviewContacts}>
                <Button size="sm" variant="outline">
                  <MessageSquareHeart />
                  Send review link
                </Button>
              </ReviewRequestDialog>
            ) : null
          }
        />

        <Card className="overflow-hidden">
          {submittedReviews.length === 0 && openLinks.length === 0 ? (
            <EmptyState
              icon={MessageSquareHeart}
              title="No reviews yet"
              description="Send a link to the client or their point of contact — by WhatsApp, SMS or email. They don't need an account."
              compact
            />
          ) : (
            <ul className="divide-y divide-border">
              {submittedReviews.map((review) => (
                <li key={review.id} className="flex gap-3 px-4 py-4 sm:px-5">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex" aria-label={`${review.rating} out of 5`}>
                        {[1, 2, 3, 4, 5].map((value) => (
                          <Star
                            key={value}
                            className={
                              value <= (review.rating ?? 0)
                                ? "size-4 fill-brand text-brand"
                                : "size-4 text-border-strong"
                            }
                          />
                        ))}
                      </span>
                      <span className="text-[13px] font-medium">{review.reviewerName ?? review.recipientName}</span>
                      <Badge variant={review.recipient === "CLIENT" ? "info" : "outline"}>
                        {review.recipient === "CLIENT" ? "Client" : "Point of contact"}
                      </Badge>
                      {review.canQuote ? <Badge variant="positive">OK to quote</Badge> : null}
                      <span className="font-mono tabular text-[12px] text-faint-foreground">
                        {review.submittedAt ? formatDay(todayInIST(review.submittedAt)) : null}
                      </span>
                    </div>
                    {review.whatWentWell ? (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-faint-foreground">
                          Went well
                        </p>
                        <p className="mt-0.5 whitespace-pre-line text-[13px] leading-relaxed">{review.whatWentWell}</p>
                      </div>
                    ) : null}
                    {review.couldImprove ? (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-faint-foreground">
                          Could be better
                        </p>
                        <p className="mt-0.5 whitespace-pre-line text-[13px] leading-relaxed">{review.couldImprove}</p>
                      </div>
                    ) : null}
                    {!review.whatWentWell && !review.couldImprove ? (
                      <p className="text-[13px] text-faint-foreground">Rating only, no comments.</p>
                    ) : null}
                  </div>
                  {canDelete ? (
                    <ReviewItemActions
                      id={review.id}
                      name={review.reviewerName ?? review.recipientName}
                      submitted
                    />
                  ) : null}
                </li>
              ))}

              {openLinks.map((review) => (
                <li key={review.id} className="flex items-center gap-3 bg-surface-2/40 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1 text-[13px] text-muted-foreground">
                    <span className="text-foreground">Waiting for {review.recipientName}</span>{" "}
                    ({review.recipient === "CLIENT" ? "client" : "point of contact"}) · link sent{" "}
                    {formatDay(todayInIST(review.requestedAt))}
                    {review.requestedBy ? ` by ${review.requestedBy.name}` : ""} · expires{" "}
                    {formatDay(todayInIST(review.expiresAt))}
                  </div>
                  {canWrite ? (
                    <ReviewItemActions id={review.id} name={review.recipientName} submitted={false} />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

function CommissionFigure({
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
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-faint-foreground">
        {label}
      </dt>
      <dd>
        <Money value={value} tone={tone} className="mt-0.5 block text-[17px] font-semibold" />
      </dd>
    </div>
  );
}
