import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Target } from "lucide-react";

import { PageHeader, SectionHeading } from "@/components/finance/page-header";
import { EmptyState } from "@/components/finance/empty-state";
import { Money } from "@/components/finance/money";
import { FilterChips, SearchInput } from "@/components/finance/data-toolbar";
import { Pagination, paginate } from "@/components/finance/pagination";
import { LeadDialog } from "@/components/dialogs/lead-dialog";
import { AddProjectForLead, LeadRowActions } from "@/components/finance/lead-row-actions";
import { LeadProjectionChart } from "@/components/charts/lead-projection-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

import { requirePageUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  compareDates,
  currentMonthKey,
  formatDay,
  formatMonthKey,
  formatMonthLabel,
  monthKeyOf,
  toDateInputValue,
  todayInIST,
} from "@/lib/dates";
import { toWire } from "@/lib/money";
import { loadLeads } from "@/lib/finance/repository";
import { loadPickerOptions } from "@/lib/finance/view-data";
import { readParam, type SearchParams } from "@/lib/finance/page-helpers";
import {
  isOpenLead,
  LEAD_QUALITIES,
  LEAD_STAGES,
  leadFlow,
  projectLeads,
  summarizeLeads,
  weightedValue,
  winProbability,
  winRate,
  type LeadQuality,
  type LeadStage,
  type PipelineLead,
} from "@/lib/finance/leads";
import { LEAD_QUALITY_LABELS, LEAD_SOURCE_LABELS, LEAD_STAGE_LABELS } from "@/lib/finance/labels";

export const metadata: Metadata = { title: "Leads" };

const STAGE_VARIANT = {
  JUST_SPOKE: "info",
  IN_PROCESS: "warning",
  WON: "positive",
  LOST: "default",
} as const;

const QUALITY_VARIANT = { HOT: "negative", WARM: "warning", COLD: "info" } as const;

const STAGE_BAR: Record<LeadStage, string> = {
  JUST_SPOKE: "bg-info",
  IN_PROCESS: "bg-warning",
  WON: "bg-positive",
  LOST: "bg-neutral",
};

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = (readParam(params, "q") ?? "").trim().toLowerCase();
  const stageFilter = readParam(params, "stage");
  const qualityFilter = readParam(params, "quality") as LeadQuality | undefined;
  const page = Number(readParam(params, "page") ?? 1) || 1;

  const [viewer, leads, { clients }] = await Promise.all([requirePageUser(), loadLeads(), loadPickerOptions()]);
  const canWrite = can(viewer.role, "finance:write");
  const canDelete = can(viewer.role, "finance:delete");

  const today = todayInIST();
  const thisMonth = currentMonthKey();
  const pipeline: PipelineLead[] = leads;
  const summary = summarizeLeads(pipeline);
  const projection = projectLeads(pipeline, thisMonth, 6);
  const flow = leadFlow(pipeline, thisMonth, 6);
  const thisMonthProjection = projection.find((point) => point.key === formatMonthKey(thisMonth));
  const overallWinRate = winRate(summary.all);
  const wonLast6 = flow.reduce((sum, point) => sum + point.wonValuePaise, 0n);
  const followUpsDue = leads.filter(
    (lead) => isOpenLead(lead) && lead.nextFollowUpOn && compareDates(lead.nextFollowUpOn, today) <= 0,
  ).length;

  const rows = leads
    .filter((lead) =>
      stageFilter === "OPEN" ? isOpenLead(lead) : stageFilter ? lead.stage === stageFilter : true,
    )
    .filter((lead) => (qualityFilter ? lead.quality === qualityFilter : true))
    .filter((lead) =>
      query
        ? [lead.name, lead.clientName, lead.contactPerson, lead.phone, lead.email, lead.requirement, lead.owner?.name]
            .filter(Boolean)
            .some((field) => field!.toLowerCase().includes(query))
        : true,
    )
    .sort((a, b) => {
      // Open work first, soonest follow-up first; closed leads after, newest first.
      const open = Number(isOpenLead(b)) - Number(isOpenLead(a));
      if (open !== 0) return open;
      const aDue = a.nextFollowUpOn?.getTime() ?? Infinity;
      const bDue = b.nextFollowUpOn?.getTime() ?? Infinity;
      return aDue - bDue || b.updatedAt.getTime() - a.updatedAt.getTime();
    });
  const view = paginate(rows, page);

  const openCount = summary.all.open;
  const sources = [...summary.bySource.entries()].sort((a, b) => b[1].count - a[1].count);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Leads"
        description="Prospects from first conversation to close. Win one and it becomes a client, ready for a project. Projections count each open lead only at its chance of closing."
        actions={
          canWrite ? (
            <LeadDialog>
              <Button size="sm">
                <Plus />
                New lead
              </Button>
            </LeadDialog>
          ) : null
        }
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          label="Open leads"
          value={String(openCount)}
          footnote={
            followUpsDue > 0 ? (
              <span className="text-warning">{followUpsDue} follow-up{followUpsDue === 1 ? "" : "s"} due</span>
            ) : (
              "No follow-ups due"
            )
          }
        />
        <Stat
          label="Likely to close"
          value={<Money value={summary.all.weightedPaise} className="text-[22px] font-semibold" />}
          footnote={
            <>
              of <Money value={summary.all.pipelinePaise} compact className="text-[12px]" /> open pipeline
            </>
          }
        />
        <Stat
          label={`Projected · ${formatMonthLabel(thisMonth)}`}
          value={<Money value={thisMonthProjection?.weightedPaise ?? 0n} className="text-[22px] font-semibold" />}
          footnote={`${thisMonthProjection?.count ?? 0} lead${thisMonthProjection?.count === 1 ? "" : "s"} due to close`}
        />
        <Stat
          label="Win rate"
          value={overallWinRate === null ? "—" : `${overallWinRate}%`}
          footnote={
            <>
              {summary.all.won} won · {summary.all.lost} lost · <Money value={wonLast6} compact className="text-[12px]" /> won in 6 mo
            </>
          }
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Month-on-month projection</CardTitle>
            <p className="text-[13px] text-muted-foreground">
              Open leads by expected close month. Weighted: Hot 25% / Warm 15% / Cold 5% after the first
              conversation; 60% / 40% / 20% once in process.
            </p>
          </CardHeader>
          <CardContent>
            {openCount === 0 ? (
              <EmptyState title="No open leads" description="Add leads with an expected value and close month to see the projection." compact />
            ) : (
              <LeadProjectionChart
                data={projection.map((point) => ({
                  label:
                    point.kind === "slipped"
                      ? "Slipped"
                      : point.kind === "unscheduled"
                        ? "No month"
                        : formatMonthLabel(point.month!, "compact"),
                  weighted: toWire(point.weightedPaise),
                  pipeline: toWire(point.pipelinePaise),
                  count: point.count,
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Stage of leads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {LEAD_STAGES.map((stage) => {
              const tally = summary.byStage[stage];
              const share = summary.all.count === 0 ? 0 : (tally.count / summary.all.count) * 100;
              return (
                <Link
                  key={stage}
                  href={`/leads?stage=${stage}`}
                  className="block rounded-md p-1.5 transition-colors hover:bg-surface-2"
                >
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span>{LEAD_STAGE_LABELS[stage]}</span>
                    <span className="font-mono tabular text-muted-foreground">{tally.count}</span>
                  </div>
                  <Meter value={share} className="mt-1.5" barClassName={STAGE_BAR[stage]} label={`${Math.round(share)}% of leads`} />
                </Link>
              );
            })}

            <div className="border-t border-border pt-3">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint-foreground">
                Quality of leads
              </p>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] text-faint-foreground">
                    <th className="pb-1 font-medium">Quality</th>
                    <th className="pb-1 text-right font-medium">Open</th>
                    <th className="pb-1 text-right font-medium">Won / lost</th>
                    <th className="pb-1 text-right font-medium">Win rate</th>
                  </tr>
                </thead>
                <tbody>
                  {LEAD_QUALITIES.map((quality) => {
                    const tally = summary.byQuality[quality];
                    const rate = winRate(tally);
                    return (
                      <tr key={quality} className="border-t border-border/60">
                        <td className="py-1.5">
                          <Badge variant={QUALITY_VARIANT[quality]}>{LEAD_QUALITY_LABELS[quality]}</Badge>
                        </td>
                        <td className="py-1.5 text-right font-mono tabular">{tally.open}</td>
                        <td className="py-1.5 text-right font-mono tabular text-muted-foreground">
                          {tally.won} / {tally.lost}
                        </td>
                        <td className="py-1.5 text-right font-mono tabular">{rate === null ? "—" : `${rate}%`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Lead flow, last 6 months</CardTitle>
          </CardHeader>
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">New</TableHead>
                  <TableHead className="text-right">Won</TableHead>
                  <TableHead className="text-right">Lost</TableHead>
                  <TableHead className="text-right">Won value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...flow].reverse().map((point) => (
                  <TableRow key={formatMonthKey(point.month)}>
                    <TableCell className="text-[13px]">{formatMonthLabel(point.month)}</TableCell>
                    <TableCell className="text-right font-mono tabular text-[13px]">{point.added}</TableCell>
                    <TableCell className="text-right font-mono tabular text-[13px] text-positive">{point.won}</TableCell>
                    <TableCell className="text-right font-mono tabular text-[13px] text-muted-foreground">{point.lost}</TableCell>
                    <TableCell className="text-right">
                      <Money value={point.wonValuePaise} tone={point.wonValuePaise > 0n ? "positive" : "muted"} className="text-[13px]" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrap>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Where good leads come from</CardTitle>
          </CardHeader>
          {sources.length === 0 ? (
            <CardContent>
              <EmptyState title="No leads yet" compact />
            </CardContent>
          ) : (
            <TableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Open value</TableHead>
                    <TableHead className="text-right">Win rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map(([source, tally]) => {
                    const rate = winRate(tally);
                    return (
                      <TableRow key={source}>
                        <TableCell className="text-[13px]">
                          {source === "UNKNOWN" ? <span className="text-muted-foreground">Not recorded</span> : LEAD_SOURCE_LABELS[source]}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular text-[13px]">{tally.count}</TableCell>
                        <TableCell className="text-right">
                          <Money value={tally.pipelinePaise} tone="muted" className="text-[13px]" />
                        </TableCell>
                        <TableCell className="text-right font-mono tabular text-[13px]">
                          {rate === null ? "—" : `${rate}%`}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </section>

      <section className="space-y-2.5">
        <SectionHeading title="All leads" />
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput placeholder="Search company, person, phone…" className="w-full sm:w-72" />
          <FilterChips
            paramKey="stage"
            options={[
              { value: "OPEN", label: "Open", count: openCount },
              ...LEAD_STAGES.map((stage) => ({
                value: stage,
                label: LEAD_STAGE_LABELS[stage],
                count: summary.byStage[stage].count,
              })),
            ]}
          />
          <FilterChips
            paramKey="quality"
            allLabel="Any quality"
            options={LEAD_QUALITIES.map((quality) => ({
              value: quality,
              label: LEAD_QUALITY_LABELS[quality],
              count: summary.byQuality[quality].count,
            }))}
          />
        </div>

        <Card className="overflow-hidden">
          {view.rows.length === 0 ? (
            <EmptyState
              icon={Target}
              title={leads.length === 0 ? "No leads yet" : "No leads match"}
              description={
                leads.length === 0
                  ? "Add everyone you've spoken to about work — stage, quality and expected value build the projection above."
                  : "Try a different search or filter."
              }
              action={
                leads.length === 0 && canWrite ? (
                  <LeadDialog>
                    <Button size="sm">
                      <Plus />
                      Add the first lead
                    </Button>
                  </LeadDialog>
                ) : null
              }
            />
          ) : (
            <>
              <TableWrap>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead className="text-right">Expected</TableHead>
                      <TableHead className="hidden lg:table-cell">Handled by</TableHead>
                      <TableHead className="hidden md:table-cell">Follow-up</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {view.rows.map((lead) => {
                      const open = isOpenLead(lead);
                      const due = open && lead.nextFollowUpOn && compareDates(lead.nextFollowUpOn, today) <= 0;
                      return (
                        <TableRow key={lead.id}>
                          <TableCell className="min-w-[13rem]">
                            <span className="font-medium">{lead.name}</span>
                            <span className="block text-[12px] text-muted-foreground">
                              {lead.clientName} ·{" "}
                              <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} className="font-mono tabular hover:text-brand">
                                {lead.phone}
                              </a>
                            </span>
                            {lead.requirement ? (
                              <span className="mt-0.5 block max-w-[18rem] truncate text-[12px] text-faint-foreground">
                                {lead.requirement}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex flex-col items-start gap-1">
                              <Badge variant={STAGE_VARIANT[lead.stage]}>{LEAD_STAGE_LABELS[lead.stage]}</Badge>
                              <Badge variant={QUALITY_VARIANT[lead.quality]}>{LEAD_QUALITY_LABELS[lead.quality]}</Badge>
                            </div>
                            {lead.stage === "WON" && lead.client ? (
                              <div className="mt-1.5">
                                {lead.client._count.projects === 0 && canWrite ? (
                                  <AddProjectForLead clientId={lead.client.id} clients={clients} />
                                ) : (
                                  <Link href={`/clients/${lead.client.id}`} className="text-[12px] text-brand hover:underline">
                                    View client →
                                  </Link>
                                )}
                              </div>
                            ) : null}
                            {lead.stage === "LOST" && lead.lostReason ? (
                              <span className="mt-1 block max-w-[10rem] truncate text-[11px] text-faint-foreground" title={lead.lostReason}>
                                {lead.lostReason}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            {lead.expectedValuePaise !== null ? (
                              <Money value={lead.expectedValuePaise} className="text-[13px]" />
                            ) : (
                              <span className="text-[13px] text-faint-foreground">—</span>
                            )}
                            <span className="block text-[11px] text-faint-foreground">
                              {lead.expectedCloseMonth ? formatMonthLabel(monthKeyOf(lead.expectedCloseMonth)) : "No month"}
                              {open && lead.expectedValuePaise !== null ? (
                                <>
                                  {" · "}
                                  {winProbability(lead)}% ≈ <Money value={weightedValue(lead)} compact className="text-[11px]" />
                                </>
                              ) : null}
                            </span>
                          </TableCell>
                          <TableCell className="hidden text-[13px] lg:table-cell">
                            {lead.owner ? lead.owner.name : <span className="text-faint-foreground">—</span>}
                            {lead.source ? (
                              <span className="block text-[11px] text-faint-foreground">via {LEAD_SOURCE_LABELS[lead.source]}</span>
                            ) : null}
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap text-[13px] md:table-cell">
                            {open && lead.nextFollowUpOn ? (
                              <span className={due ? "font-medium text-warning" : "text-muted-foreground"}>
                                {formatDay(lead.nextFollowUpOn)}
                                {due ? <span className="block text-[11px]">Due</span> : null}
                              </span>
                            ) : lead.closedOn ? (
                              <span className="text-[12px] text-faint-foreground">Closed {formatDay(lead.closedOn)}</span>
                            ) : (
                              <span className="text-faint-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <LeadRowActions
                              clients={clients}
                              clientId={lead.clientId}
                              canWrite={canWrite}
                              canDelete={canDelete}
                              lead={{
                                id: lead.id,
                                name: lead.name,
                                clientName: lead.clientName,
                                phone: lead.phone,
                                contactPerson: lead.contactPerson,
                                contactPhone: lead.contactPhone,
                                email: lead.email,
                                website: lead.website,
                                stage: lead.stage,
                                quality: lead.quality,
                                source: lead.source,
                                expectedValuePaise: lead.expectedValuePaise === null ? null : toWire(lead.expectedValuePaise),
                                expectedCloseMonth: lead.expectedCloseMonth
                                  ? formatMonthKey(monthKeyOf(lead.expectedCloseMonth))
                                  : null,
                                requirement: lead.requirement,
                                ownerId: lead.ownerId,
                                nextFollowUpOn: toDateInputValue(lead.nextFollowUpOn) || null,
                                lostReason: lead.lostReason,
                                notes: lead.notes,
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableWrap>
              <Pagination {...view} basePath="/leads" params={params} noun="leads" />
            </>
          )}
        </Card>
      </section>
    </div>
  );
}

function Stat({ label, value, footnote }: { label: string; value: React.ReactNode; footnote?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-faint-foreground">{label}</p>
      <p className="mt-1.5 font-mono tabular text-[22px] font-semibold">{value}</p>
      {footnote ? <p className="mt-0.5 text-[12px] text-faint-foreground">{footnote}</p> : null}
    </div>
  );
}
