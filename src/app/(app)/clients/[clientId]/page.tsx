import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Building2, FolderPlus, Globe, Mail, Pencil, Phone, User } from "lucide-react";

import { PageHeader, SectionHeading } from "@/components/finance/page-header";
import { MetricCard } from "@/components/finance/metric-card";
import { EmptyState } from "@/components/finance/empty-state";
import { Money } from "@/components/finance/money";
import { ProjectStatusBadge } from "@/components/finance/status-badge";
import { ClientDialog } from "@/components/dialogs/client-dialog";
import { ProjectDialog } from "@/components/dialogs/project-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrap,
} from "@/components/ui/table";

import { prisma } from "@/lib/db";
import { formatDay } from "@/lib/dates";
import { loadFinanceIndex } from "@/lib/finance/repository";
import { loadPickerOptions } from "@/lib/finance/view-data";
import { PAYMENT_METHOD_LABELS } from "@/lib/finance/labels";
import { getCurrentUser, requirePageUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clientId: string }>;
}): Promise<Metadata> {
  const { clientId } = await params;
  // Metadata renders on its own and lands in <title>, so it checks access too.
  if (!(await getCurrentUser())) return { title: "Client" };
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  return { title: client?.name ?? "Client" };
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

  const viewer = await requirePageUser();
  const [client, index, { clients: clientOptions }] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId } }),
    loadFinanceIndex(),
    loadPickerOptions(),
  ]);
  if (!client) notFound();

  const canWrite = can(viewer.role, "finance:write");

  const projects = [...index.projectRollups.values()]
    .filter((rollup) => rollup.project.clientId === clientId)
    .sort((a, b) => (b.budgetPaise > a.budgetPaise ? 1 : b.budgetPaise < a.budgetPaise ? -1 : 0));

  const live = projects.filter((rollup) => rollup.project.archivedAt === null);
  const totalBudget = live.reduce((sum, row) => sum + row.budgetPaise, 0n);
  const totalReceived = live.reduce((sum, row) => sum + row.receivedPaise, 0n);
  const totalOutstanding = live.reduce(
    (sum, row) => sum + (row.isForecastable ? row.scheduledOutstandingPaise : 0n),
    0n,
  );
  const totalOverdue = live.reduce(
    (sum, row) => sum + (row.isForecastable ? row.overduePaise : 0n),
    0n,
  );

  const projectIds = new Set(projects.map((rollup) => rollup.project.id));
  const receipts = index.dataset.receipts
    .filter((receipt) => projectIds.has(receipt.projectId))
    .sort((a, b) => b.receivedOn.getTime() - a.receivedOn.getTime())
    .slice(0, 10);

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link href="/clients">
          <ArrowLeft />
          All clients
        </Link>
      </Button>

      <PageHeader
        title={client.name}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {client.companyName ? (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-3.5 text-faint-foreground" />
                {client.companyName}
              </span>
            ) : null}
            {client.website ? (
              <a
                href={client.website}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 hover:text-brand"
              >
                <Globe className="size-3.5 text-faint-foreground" />
                {client.website.replace(/^https?:\/\//, "")}
              </a>
            ) : null}
            {client.clientName || client.phone ? (
              <PersonLine icon={User} label="Client" name={client.clientName} phone={client.phone} />
            ) : null}
            {client.contactPerson || client.contactPhone ? (
              <PersonLine
                icon={Phone}
                label="Point of contact"
                name={client.contactPerson}
                phone={client.contactPhone}
              />
            ) : null}
            {client.email ? (
              <a
                href={`mailto:${client.email}`}
                className="inline-flex items-center gap-1.5 hover:text-brand"
              >
                <Mail className="size-3.5 text-faint-foreground" />
                {client.email}
              </a>
            ) : null}
            {client.archivedAt ? <Badge>Archived</Badge> : null}
            {client.isDemo ? <Badge variant="info">Demo data</Badge> : null}
          </span>
        }
        actions={
          !canWrite ? null : (
          <>
            <ClientDialog
              initial={{
                id: client.id,
                name: client.name,
                companyName: client.companyName,
                clientName: client.clientName,
                website: client.website,
                contactPerson: client.contactPerson,
                contactPhone: client.contactPhone,
                email: client.email,
                phone: client.phone,
                notes: client.notes,
              }}
            >
              <Button variant="outline" size="sm">
                <Pencil />
                Edit client
              </Button>
            </ClientDialog>
            <ProjectDialog clients={clientOptions} defaultClientId={client.id}>
              <Button size="sm">
                <FolderPlus />
                New project
              </Button>
            </ProjectDialog>
          </>
          )
        }
      />

      {client.notes ? (
        <p className="rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
          {client.notes}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Contract value" value={totalBudget} footnote={`${live.length} live projects`} />
        <MetricCard label="Collected to date" value={totalReceived} kind="actual" />
        <MetricCard
          label="Scheduled outstanding"
          value={totalOutstanding}
          kind="forecast"
          footnote="Approved projects only"
        />
        <MetricCard
          label="Overdue"
          value={totalOverdue}
          tone={totalOverdue > 0n ? "negative" : "default"}
          kind="actual"
        />
      </section>

      <section className="space-y-2.5">
        <SectionHeading title="Projects" />
        <Card className="overflow-hidden">
          {projects.length === 0 ? (
            <EmptyState
              icon={FolderPlus}
              title="No projects yet"
              description={`Create the first project for ${client.name}.`}
              action={
                canWrite ? (
                  <ProjectDialog clients={clientOptions} defaultClientId={client.id}>
                    <Button size="sm">New project</Button>
                  </ProjectDialog>
                ) : null
              }
            />
          ) : (
            <TableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="hidden md:table-cell">Next payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((rollup) => (
                    <TableRow key={rollup.project.id}>
                      <TableCell>
                        <Link
                          href={`/projects/${rollup.project.id}`}
                          className="font-medium hover:text-brand"
                        >
                          {rollup.project.name}
                        </Link>
                        {rollup.project.archivedAt ? (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-faint-foreground">
                            Archived
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <ProjectStatusBadge status={rollup.project.status} />
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
                      <TableCell className="hidden whitespace-nowrap font-mono tabular text-[13px] text-muted-foreground md:table-cell">
                        {rollup.nextPaymentDate ? formatDay(rollup.nextPaymentDate) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </section>

      <section className="space-y-2.5">
        <SectionHeading title="Recent receipts" description="The last ten payments received from this client." />
        <Card className="overflow-hidden">
          {receipts.length === 0 ? (
            <EmptyState title="No payments received yet" compact />
          ) : (
            <TableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="hidden sm:table-cell">Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((receipt) => {
                    const project = index.projectsById.get(receipt.projectId);
                    return (
                      <TableRow key={receipt.id}>
                        <TableCell className="whitespace-nowrap font-mono tabular text-[13px]">
                          {formatDay(receipt.receivedOn)}
                        </TableCell>
                        <TableCell className="text-[13px]">
                          <Link
                            href={`/projects/${receipt.projectId}`}
                            className="hover:text-brand"
                          >
                            {project?.name ?? "—"}
                          </Link>
                        </TableCell>
                        <TableCell className="text-[13px] text-muted-foreground">
                          {PAYMENT_METHOD_LABELS[receipt.method]}
                        </TableCell>
                        <TableCell className="hidden font-mono tabular text-[12px] text-faint-foreground sm:table-cell">
                          {receipt.reference ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Money value={receipt.amountPaise} className="text-[13px]" />
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
    </div>
  );
}

/** A person with a tap-to-call number — on a phone, the number dials. */
function PersonLine({
  icon: Icon,
  label,
  name,
  phone,
}: {
  icon: typeof User;
  label: string;
  name: string | null;
  phone: string | null;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5 text-faint-foreground" />
      <span className="text-faint-foreground">{label}:</span>
      {name ?? "—"}
      {phone ? (
        <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="font-mono tabular hover:text-brand">
          {phone}
        </a>
      ) : null}
    </span>
  );
}
