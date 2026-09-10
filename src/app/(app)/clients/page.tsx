import Link from "next/link";
import type { Metadata } from "next";
import { Building2, Download, FolderPlus, Globe, Plus, UserPlus } from "lucide-react";

import { PageHeader } from "@/components/finance/page-header";
import { EmptyState } from "@/components/finance/empty-state";
import { Money } from "@/components/finance/money";
import { ProjectStatusBadge } from "@/components/finance/status-badge";
import { ClientDialog } from "@/components/dialogs/client-dialog";
import { ProjectDialog } from "@/components/dialogs/project-dialog";
import { ClientRowActions } from "@/components/finance/client-row-actions";
import { ProjectRowActions } from "@/components/finance/project-row-actions";
import { FilterChips, ParamSelect, SearchInput, ToggleParam } from "@/components/finance/data-toolbar";
import { Pagination, paginate } from "@/components/finance/pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

import { formatDay, formatMonthKey, toDateInputValue, todayInIST } from "@/lib/dates";
import { percentOf } from "@/lib/money";
import { loadClients, loadFinanceIndex } from "@/lib/finance/repository";
import { loadPickerOptions } from "@/lib/finance/view-data";
import { toProjectInitial } from "@/components/finance/options";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/finance/types";
import { PROJECT_STATUS_LABELS, RECURRING_INTERVAL_SHORT } from "@/lib/finance/labels";
import { readParam, resolveMonth, withParams, type SearchParams } from "@/lib/finance/page-helpers";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Clients & Projects" };

type Tab = "clients" | "projects";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const tab: Tab = readParam(params, "tab") === "projects" ? "projects" : "clients";
  const query = (readParam(params, "q") ?? "").trim().toLowerCase();
  const statusFilter = readParam(params, "status") as ProjectStatus | undefined;
  const extraFilter = readParam(params, "filter");
  const showArchived = readParam(params, "archived") === "1";
  const sort = readParam(params, "sort") ?? "value";
  const page = Number(readParam(params, "page") ?? 1) || 1;
  const monthParam = formatMonthKey(resolveMonth(params));

  const [viewer, index, { clients: clientOptions, projects: projectOptions }, clientRecords] =
    await Promise.all([requireUser(), loadFinanceIndex(), loadPickerOptions(), loadClients()]);

  const canWrite = can(viewer.role, "finance:write");

  const today = toDateInputValue(todayInIST());

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clients & Projects"
        description="Every project belongs to a client. Only approved projects feed the monthly forecast; pending and on-hold work sits in the potential pipeline."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/api/export/${tab}${withParams(params, { page: undefined })}`}>
                <Download />
                Export CSV
              </Link>
            </Button>
            {!canWrite ? null : tab === "clients" ? (
              <ClientDialog>
                <Button size="sm">
                  <UserPlus />
                  New client
                </Button>
              </ClientDialog>
            ) : (
              <ProjectDialog clients={clientOptions}>
                <Button size="sm">
                  <FolderPlus />
                  New project
                </Button>
              </ProjectDialog>
            )}
          </>
        }
      />

      {/* Tabs are links so the view stays shareable and server-rendered. */}
      <div className="flex items-center gap-1 border-b border-border">
        {(["clients", "projects"] as Tab[]).map((value) => (
          <Link
            key={value}
            href={`/clients${withParams(params, { tab: value, page: undefined, status: undefined, filter: undefined })}`}
            aria-current={tab === value ? "page" : undefined}
            className={
              tab === value
                ? "relative -mb-px border-b-2 border-brand px-3 py-2 text-[13px] font-medium text-foreground"
                : "relative -mb-px border-b-2 border-transparent px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            }
          >
            {value === "clients" ? "Clients" : "Projects"}
            <span className="ml-1.5 font-mono tabular text-[11px] text-faint-foreground">
              {value === "clients"
                ? clientRecords.filter((row) => showArchived || row.archivedAt === null).length
                : projectOptions.length}
            </span>
          </Link>
        ))}
      </div>

      {tab === "clients"
        ? renderClients()
        : renderProjects()}
    </div>
  );

  /* ------------------------------------------------------------------ */

  function renderClients() {
    const rows = clientRecords
      .filter((client) => (showArchived ? true : client.archivedAt === null))
      .filter((client) =>
        query
          ? [client.name, client.contactPerson, client.email, client.phone]
              .filter(Boolean)
              .some((field) => field!.toLowerCase().includes(query))
          : true,
      )
      .map((client) => {
        const projects = [...index.projectRollups.values()].filter(
          (rollup) => rollup.project.clientId === client.id && rollup.project.archivedAt === null,
        );
        return {
          client,
          projectCount: projects.length,
          collected: projects.reduce((sum, row) => sum + row.receivedPaise, 0n),
          outstanding: projects.reduce(
            (sum, row) => sum + (row.isForecastable ? row.scheduledOutstandingPaise : 0n),
            0n,
          ),
          overdue: projects.reduce(
            (sum, row) => sum + (row.isForecastable ? row.overduePaise : 0n),
            0n,
          ),
        };
      })
      .sort((a, b) =>
        sort === "name"
          ? a.client.name.localeCompare(b.client.name)
          : b.collected > a.collected
            ? 1
            : b.collected < a.collected
              ? -1
              : 0,
      );

    const view = paginate(rows, page);

    return (
      <>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput placeholder="Search clients, contacts, email…" className="w-full sm:w-72" />
          <ParamSelect
            paramKey="sort"
            label="Sort clients"
            defaultValue="value"
            options={[
              { value: "value", label: "Most collected" },
              { value: "name", label: "Name A–Z" },
            ]}
          />
          <ToggleParam paramKey="archived" label="Show archived" />
        </div>

        <Card className="overflow-hidden">
          {view.rows.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={query ? "No clients match that search" : "No clients yet"}
              description={
                query
                  ? "Try a different name, contact or email."
                  : "Add your first client, then create a project against them."
              }
              action={
                query || !canWrite ? null : (
                  <ClientDialog>
                    <Button size="sm">
                      <Plus />
                      Add a client
                    </Button>
                  </ClientDialog>
                )
              }
            />
          ) : (
            <>
              <TableWrap>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead className="hidden md:table-cell">Contact</TableHead>
                      <TableHead className="text-right">Projects</TableHead>
                      <TableHead className="text-right">Collected</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {view.rows.map(({ client, projectCount, collected, outstanding, overdue }) => (
                      <TableRow key={client.id}>
                        <TableCell>
                          <Link
                            href={`/clients/${client.id}`}
                            className="font-medium hover:text-brand"
                          >
                            {client.name}
                          </Link>
                          {client.companyName ? (
                            <span className="block text-[12px] text-muted-foreground">
                              {client.companyName}
                            </span>
                          ) : null}
                          {client.archivedAt ? (
                            <span className="ml-2 rounded border border-border px-1 py-px text-[10px] uppercase tracking-wide text-faint-foreground">
                              Archived
                            </span>
                          ) : null}
                          {client.isDemo ? (
                            <span className="ml-2 rounded border border-info/35 bg-info-soft px-1 py-px text-[10px] uppercase tracking-wide text-info">
                              Demo
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="hidden text-[13px] text-muted-foreground md:table-cell">
                          {client.contactPerson ?? "—"}
                          {client.email ? (
                            <span className="block text-[12px] text-faint-foreground">
                              {client.email}
                            </span>
                          ) : null}
                          {client.website ? (
                            <a
                              href={client.website}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-brand hover:underline"
                            >
                              <Globe className="size-3" />
                              {client.website.replace(/^https?:\/\//, "")}
                            </a>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular text-[13px] text-muted-foreground">
                          {projectCount}
                        </TableCell>
                        <TableCell className="text-right">
                          <Money value={collected} className="text-[13px]" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Money value={outstanding} className="text-[13px]" />
                          {overdue > 0n ? (
                            <span className="block text-[11px] text-negative">
                              <Money value={overdue} className="text-[11px]" tone="negative" /> overdue
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {canWrite ? (
                          <ClientRowActions
                            archived={client.archivedAt !== null}
                            projectCount={client._count.projects}
                            client={{
                              id: client.id,
                              name: client.name,
                              companyName: client.companyName,
                              website: client.website,
                              contactPerson: client.contactPerson,
                              email: client.email,
                              phone: client.phone,
                              notes: client.notes,
                            }}
                          />
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableWrap>
              <Pagination {...view} basePath="/clients" params={params} noun="clients" />
            </>
          )}
        </Card>
      </>
    );
  }

  function renderProjects() {
    const rows = [...index.projectRollups.values()]
      .filter((rollup) => (showArchived ? true : rollup.project.archivedAt === null))
      .filter((rollup) => (statusFilter ? rollup.project.status === statusFilter : true))
      .filter((rollup) =>
        extraFilter === "unscheduled"
          ? rollup.isForecastable && rollup.unscheduledPaise > 0n
          : extraFilter === "overdue"
            ? rollup.overduePaise > 0n
            : true,
      )
      .filter((rollup) =>
        query
          ? `${rollup.project.name} ${rollup.project.clientName}`.toLowerCase().includes(query)
          : true,
      )
      .sort((a, b) => {
        if (sort === "name") return a.project.name.localeCompare(b.project.name);
        if (sort === "client") return a.project.clientName.localeCompare(b.project.clientName);
        if (sort === "outstanding") {
          return b.remainingBalancePaise > a.remainingBalancePaise
            ? 1
            : b.remainingBalancePaise < a.remainingBalancePaise
              ? -1
              : 0;
        }
        return b.budgetPaise > a.budgetPaise ? 1 : b.budgetPaise < a.budgetPaise ? -1 : 0;
      });

    const view = paginate(rows, page);
    const counts = Object.fromEntries(
      PROJECT_STATUSES.map((status) => [
        status,
        [...index.projectRollups.values()].filter(
          (rollup) => rollup.project.status === status && rollup.project.archivedAt === null,
        ).length,
      ]),
    );

    return (
      <>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput placeholder="Search projects or clients…" className="w-full sm:w-72" />
          <FilterChips
            paramKey="status"
            options={PROJECT_STATUSES.map((status) => ({
              value: status,
              label: PROJECT_STATUS_LABELS[status],
              count: counts[status],
            }))}
          />
          <ParamSelect
            paramKey="sort"
            label="Sort projects"
            defaultValue="value"
            options={[
              { value: "value", label: "Largest budget" },
              { value: "outstanding", label: "Most outstanding" },
              { value: "name", label: "Project A–Z" },
              { value: "client", label: "Client A–Z" },
            ]}
          />
          <ToggleParam paramKey="archived" label="Show archived" />
        </div>

        <Card className="overflow-hidden">
          {view.rows.length === 0 ? (
            <EmptyState
              icon={FolderPlus}
              title="No projects match"
              description="Adjust the filters, or create a project against one of your clients."
              action={
                canWrite ? (
                  <ProjectDialog clients={clientOptions}>
                    <Button size="sm">
                      <Plus />
                      New project
                    </Button>
                  </ProjectDialog>
                ) : null
              }
            />
          ) : (
            <>
              <TableWrap>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Recurring</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead className="hidden text-right xl:table-cell">Scheduled</TableHead>
                      <TableHead className="hidden text-right xl:table-cell">Unscheduled</TableHead>
                      <TableHead className="hidden text-right xl:table-cell">Commission</TableHead>
                      <TableHead className="hidden md:table-cell">Next payment</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {view.rows.map((rollup) => {
                      const option = projectOptions.find((row) => row.id === rollup.project.id);
                      const collectedShare = percentOf(rollup.receivedPaise, rollup.budgetPaise) ?? 0;
                      return (
                        <TableRow key={rollup.project.id}>
                          <TableCell className="min-w-[15rem]">
                            <Link
                              href={`/projects/${rollup.project.id}`}
                              className="font-medium hover:text-brand"
                            >
                              {rollup.project.name}
                            </Link>
                            <span className="block text-[12px] text-muted-foreground">
                              {rollup.project.clientName}
                            </span>
                            <Meter
                              value={collectedShare}
                              className="mt-1.5 max-w-[10rem]"
                              barClassName={rollup.isForecastable ? "bg-brand" : "bg-neutral"}
                              label={`${Math.round(collectedShare)}% of budget collected`}
                            />
                          </TableCell>
                          <TableCell>
                            <ProjectStatusBadge status={rollup.project.status} />
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap lg:table-cell">
                            {rollup.project.billingType === "SUBSCRIPTION" &&
                            rollup.project.recurringAmountPaise !== null &&
                            rollup.project.recurringInterval !== null ? (
                              <>
                                <span className="text-[13px]">
                                  <Money
                                    value={rollup.project.recurringAmountPaise}
                                    className="text-[13px]"
                                  />
                                  <span className="text-faint-foreground">
                                    {RECURRING_INTERVAL_SHORT[rollup.project.recurringInterval]}
                                  </span>
                                </span>
                                <span className="block text-[11px] text-faint-foreground">
                                  <Money
                                    value={rollup.annualisedRecurringPaise}
                                    compact
                                    className="text-[11px]"
                                  />{" "}
                                  a year
                                </span>
                              </>
                            ) : (
                              <span className="text-[13px] text-faint-foreground">One-off</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Money value={rollup.budgetPaise} className="text-[13px]" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Money value={rollup.receivedPaise} className="text-[13px]" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Money value={rollup.remainingBalancePaise} className="text-[13px]" />
                          </TableCell>
                          <TableCell className="hidden text-right xl:table-cell">
                            <Money
                              value={rollup.scheduledOutstandingPaise}
                              tone="muted"
                              className="text-[13px]"
                            />
                          </TableCell>
                          <TableCell className="hidden text-right xl:table-cell">
                            <Money
                              value={rollup.unscheduledPaise}
                              tone={rollup.unscheduledPaise > 0n ? "warning" : "muted"}
                              className="text-[13px]"
                            />
                          </TableCell>
                          <TableCell className="hidden text-right xl:table-cell">
                            {rollup.project.commissionBasis ? (
                              <>
                                <Money
                                  value={rollup.commissionOutstandingPaise}
                                  tone={rollup.commissionOutstandingPaise > 0n ? "warning" : "muted"}
                                  className="text-[13px]"
                                />
                                <span className="block truncate text-[11px] text-faint-foreground">
                                  {rollup.project.commissionBasis === "PERCENT_OF_RECEIVED"
                                    ? `${(rollup.project.commissionRateBps ?? 0) / 100}% to ${rollup.project.commissionPayee ?? "referrer"}`
                                    : `flat to ${rollup.project.commissionPayee ?? "referrer"}`}
                                </span>
                              </>
                            ) : (
                              <span className="text-[13px] text-faint-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap text-[13px] text-muted-foreground md:table-cell">
                            {rollup.nextPaymentDate ? (
                              <>
                                <span className="font-mono tabular">
                                  {formatDay(rollup.nextPaymentDate)}
                                </span>
                                <span className="block text-[11px] text-faint-foreground">
                                  <Money value={rollup.nextPaymentPaise} className="text-[11px]" />
                                </span>
                              </>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            {option && canWrite ? (
                              <ProjectRowActions
                                project={rollup.project}
                                option={option}
                                clients={clientOptions}
                                archived={rollup.project.archivedAt !== null}
                                receiptCount={rollup.receiptCount}
                                today={today}
                                initial={toProjectInitial(option)}
                              />
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableWrap>
              <Pagination {...view} basePath="/clients" params={params} noun="projects" />
            </>
          )}
        </Card>

        <p className="text-[12px] text-faint-foreground">
          Viewing figures for {monthParam}. Project totals are all-time; only the monthly forecast
          depends on the selected month.
        </p>
      </>
    );
  }
}
