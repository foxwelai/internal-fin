import Link from "next/link";
import type { Metadata } from "next";
import { Contact, Download, Mail, Phone, Plus, Users } from "lucide-react";

import { PageHeader } from "@/components/finance/page-header";
import { Money } from "@/components/finance/money";
import { CashMovementDialog } from "@/components/dialogs/cash-movement-dialog";
import {
  CashMovementRowActions,
  CompanySettingsForm,
  DemoDataControls,
} from "@/components/finance/settings-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { can, ROLE_LABELS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import {
  formatDay,
  formatMonthKey,
  currentMonthKey,
  toDateInputValue,
  todayInIST,
} from "@/lib/dates";
import { formatForCsv, toWire } from "@/lib/money";
import { hasDemoData, loadSettings, loadTeamMembers } from "@/lib/finance/repository";
import { TeamMemberDialog } from "@/components/dialogs/team-member-dialog";
import { TeamMemberRowActions } from "@/components/finance/team-member-row-actions";
import { loadTeamView } from "@/lib/team";
import { PeopleList } from "@/components/finance/people-list";
import { UserDialog } from "@/components/dialogs/user-dialog";
import { EmptyState } from "@/components/finance/empty-state";
import { CASH_MOVEMENT_LABELS } from "@/lib/finance/labels";
import { signedCashMovement } from "@/lib/finance/engine";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await requirePageUser();
  const canManageUsers = can(viewer.role, "users:manage");
  const canManageSettings = can(viewer.role, "settings:manage");
  const canWrite = can(viewer.role, "finance:write");
  const canDelete = can(viewer.role, "finance:delete");

  const [settings, movements, demoLoaded, team, members] = await Promise.all([
    loadSettings(),
    prisma.cashMovement.findMany({ orderBy: { occurredOn: "desc" } }),
    hasDemoData(),
    canManageUsers ? loadTeamView() : Promise.resolve(null),
    loadTeamMembers(),
  ]);

  const waiting = team?.people.filter((person) => person.state === "needs-access").length ?? 0;
  const today = toDateInputValue(todayInIST());
  const monthParam = formatMonthKey(currentMonthKey());

  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader
        title="Settings"
        description="Company details, the Foxwel team, cash-balance tracking, exports and your sign-in credentials."
      />

      {/* ------------------------------ Company ---------------------------- */}

      {canManageSettings ? (
      <Card id="cash">
        <CardHeader>
          <CardTitle>Company & cash balance</CardTitle>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            An opening balance turns on the running cash position on Overview. Only receipts and
            expense payments dated on or after the effective date are counted, so you can start
            tracking from a bank statement without back-filling history.
          </p>
        </CardHeader>
        <CardContent>
          <CompanySettingsForm
            companyName={settings.companyName}
            openingBalance={
              settings.openingBalancePaise !== null
                ? formatForCsv(settings.openingBalancePaise)
                : ""
            }
            openingBalanceDate={toDateInputValue(settings.openingBalanceDate)}
          />
        </CardContent>
      </Card>
      ) : null}

      {/* ---------------------------- Foxwel team -------------------------- */}

      <Card id="foxwel-team" className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Contact className="size-4 text-faint-foreground" />
            Foxwel team & interns
          </CardTitle>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Everyone here can be picked as a project&rsquo;s coordinator. Separate from Team access
            below — being listed doesn&rsquo;t let anyone sign in.
          </p>
        </CardHeader>

        {(["EMPLOYEE", "INTERN"] as const).map((kind) => {
          const group = members.filter((member) => member.kind === kind);
          const noun = kind === "INTERN" ? "intern" : "team member";
          return (
            <section key={kind} className="border-t border-border">
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                <h3 className="text-[12px] font-semibold uppercase tracking-wider text-faint-foreground">
                  {kind === "INTERN" ? "Interns" : "Team"}
                  <span className="ml-1.5 font-mono tabular">{group.length}</span>
                </h3>
                {canWrite ? (
                  <TeamMemberDialog defaultKind={kind}>
                    <Button size="sm" variant="outline">
                      <Plus />
                      Add {noun}
                    </Button>
                  </TeamMemberDialog>
                ) : null}
              </div>

              {group.length === 0 ? (
                <p className="px-4 pb-4 text-[13px] text-muted-foreground sm:px-5">
                  No {noun}s yet. Add them with a phone number, role and email so they&rsquo;re ready
                  to assign.
                </p>
              ) : (
                <ul className="divide-y divide-border border-t border-border">
                  {group.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
                    >
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium">
                          <span className={member.isActive ? "" : "text-muted-foreground line-through"}>
                            {member.name}
                          </span>
                          {member.designation ? (
                            <span className="rounded border border-border px-1.5 py-px text-[11px] font-normal text-muted-foreground">
                              {member.designation}
                            </span>
                          ) : null}
                          {member.isActive ? null : (
                            <span className="rounded border border-border px-1 py-px text-[10px] uppercase tracking-wide text-faint-foreground">
                              Left
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
                          {member.phone ? (
                            <a
                              href={`tel:${member.phone.replace(/[^\d+]/g, "")}`}
                              className="inline-flex items-center gap-1 font-mono tabular hover:text-brand"
                            >
                              <Phone className="size-3" />
                              {member.phone}
                            </a>
                          ) : null}
                          {member.email ? (
                            <a
                              href={`mailto:${member.email}`}
                              className="inline-flex min-w-0 items-center gap-1 hover:text-brand"
                            >
                              <Mail className="size-3 shrink-0" />
                              <span className="truncate">{member.email}</span>
                            </a>
                          ) : null}
                          <span className="text-faint-foreground">
                            {member._count.coordinatedProjects === 0
                              ? "No projects"
                              : `${member._count.coordinatedProjects} project${member._count.coordinatedProjects === 1 ? "" : "s"}`}
                          </span>
                        </p>
                      </div>
                      {canWrite ? (
                        <TeamMemberRowActions
                          member={{
                            id: member.id,
                            kind: member.kind,
                            name: member.name,
                            phone: member.phone,
                            designation: member.designation,
                            email: member.email,
                          }}
                          active={member.isActive}
                          projectCount={member._count.coordinatedProjects}
                          canDelete={canDelete}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </Card>

      {/* -------------------------- Cash movements ------------------------- */}

      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Funding & owner movements</CardTitle>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Money that moves the bank balance but is not trading: loans, founder contributions,
              owner draws and transfers. Tracked here so they never flatter — or dent — the
              operating surplus.
            </p>
          </div>
          {canWrite ? (
            <CashMovementDialog today={today}>
              <Button size="sm" variant="outline">
                <Plus />
                Add
              </Button>
            </CashMovementDialog>
          ) : null}
        </CardHeader>

        {movements.length === 0 ? (
          <CardContent>
            <EmptyState
              title="No cash movements recorded"
              description="Add one when you draw on a credit line, put money in, or take money out."
              compact
            />
          </CardContent>
        ) : (
          <TableWrap>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Effect on cash</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell className="whitespace-nowrap font-mono tabular text-[13px]">
                      {formatDay(movement.occurredOn)}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {movement.label}
                      {movement.isDemo ? (
                        <span className="ml-2 rounded border border-info/35 bg-info-soft px-1 py-px text-[10px] uppercase tracking-wide text-info">
                          Demo
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {CASH_MOVEMENT_LABELS[movement.type]}
                    </TableCell>
                    <TableCell className="text-right">
                      <Money
                        value={signedCashMovement(movement.type, movement.amountPaise)}
                        tone="auto"
                        signed
                        className="text-[13px]"
                      />
                    </TableCell>
                    <TableCell>
                      {canWrite ? (
                      <CashMovementRowActions
                        today={today}
                        movement={{
                          id: movement.id,
                          type: movement.type,
                          label: movement.label,
                          amountPaise: toWire(movement.amountPaise),
                          occurredOn: toDateInputValue(movement.occurredOn),
                          notes: movement.notes,
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

      {/* ------------------------------ Exports ---------------------------- */}

      <Card>
        <CardHeader>
          <CardTitle>Exports</CardTitle>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            CSV files with amounts as plain decimal rupees. Exporting from a filtered page gives you
            exactly the rows on screen.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {[
            { href: "/api/export/clients", label: "Clients" },
            { href: "/api/export/projects", label: "Projects" },
            { href: `/api/export/payments?month=${monthParam}&view=received`, label: "Receipts, this month" },
            { href: `/api/export/payments?month=${monthParam}&view=scheduled`, label: "Scheduled payments" },
            { href: `/api/export/expenses?month=${monthParam}`, label: "Expenses, this month" },
            { href: "/api/template/expenses", label: "Expense import template" },
          ].map((item) => (
            <Button key={item.href} asChild variant="outline" size="sm">
              <Link href={item.href}>
                <Download />
                {item.label}
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* ----------------------------- Demo data --------------------------- */}

      {canManageSettings ? (
      <Card id="demo">
        <CardHeader>
          <CardTitle>Demo data</CardTitle>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            A clearly-labelled fictional dataset, kept entirely separate from real company records.
          </p>
        </CardHeader>
        <CardContent>
          <DemoDataControls loaded={demoLoaded} />
        </CardContent>
      </Card>
      ) : null}

      {/* -------------------------------- Team ----------------------------- */}

      {canManageUsers && team ? (
        <Card id="team" className="overflow-hidden">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex flex-wrap items-center gap-2">
                <Users className="size-4 text-faint-foreground" />
                Team access
                {waiting > 0 ? (
                  <span className="rounded-full border border-warning/35 bg-warning-soft px-1.5 py-px text-[11px] font-medium text-warning">
                    {waiting} waiting
                  </span>
                ) : null}
              </CardTitle>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Everyone who has signed up appears here — including people who never got past
                sign-up. Change the dropdown to give or remove access; it saves straight away and
                applies on their next click.
              </p>
            </div>
            <UserDialog>
              <Button size="sm" variant="outline" className="shrink-0">
                <Plus />
                <span className="hidden sm:inline">Invite by email</span>
                <span className="sm:hidden">Invite</span>
              </Button>
            </UserDialog>
          </CardHeader>

          {team.clerkError ? (
            <p className="mx-4 mb-3 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-[12px] leading-relaxed text-warning sm:mx-5">
              {team.clerkError}
            </p>
          ) : null}

          <div className="border-t border-border">
            <PeopleList
              people={team.people.map((person) => ({
                ...person,
                signedUpAt: person.signedUpAt?.toISOString() ?? null,
                lastSignInAt: person.lastSignInAt?.toISOString() ?? null,
                isSelf: person.userId === viewer.id,
                isLastSuperAdmin:
                  person.access === "SUPER_ADMIN" && team.activeSuperAdmins <= 1,
              }))}
            />
          </div>
        </Card>
      ) : null}

      {/* ------------------------------ Account ---------------------------- */}

      <Card id="account">
        <CardHeader>
          <CardTitle>Your account</CardTitle>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Signed in as <span className="text-foreground">{viewer.email}</span>, with the role{" "}
            <span className="text-foreground">{ROLE_LABELS[viewer.role]}</span>. Your name,
            password, email and two-step verification are managed by Clerk — open them from your
            avatar in the top right.
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How the numbers are calculated</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-[13px] leading-relaxed text-muted-foreground">
          <p>
            This is a <span className="text-foreground">cash-based management view</span>: the
            surplus or deficit is money that actually arrived less money that actually left, in the
            month it moved. It is not accounting net profit — there are no accruals, no
            depreciation, and no tax.
          </p>
          <ul className="ml-4 list-disc space-y-1.5">
            <li>
              <span className="text-foreground">Money received</span> — receipts dated inside the
              month, whatever the project&rsquo;s status.
            </li>
            <li>
              <span className="text-foreground">Expected this month</span> — the unpaid portion of
              scheduled payments due inside the month, on approved projects only.
            </li>
            <li>
              <span className="text-foreground">Remaining contract balance</span> — project budget
              less every receipt against it, so an advance consumes budget rather than adding
              revenue.
            </li>
            <li>
              <span className="text-foreground">Overdue from earlier months</span> — reported
              separately and never added to a later month&rsquo;s forecast until you reschedule it.
            </li>
            <li>
              <span className="text-foreground">Cash paid out</span> — expense payments dated inside
              the month, whichever month the expense was budgeted to.
            </li>
            <li>
              <span className="text-foreground">Cash surplus margin</span> — actual surplus over
              actual collections, shown as &ldquo;—&rdquo; when nothing was collected.
            </li>
          </ul>
          <p>
            All amounts are stored as integer paise and dated in Asia/Kolkata. No floating-point
            arithmetic touches a monetary value.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
