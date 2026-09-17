import Link from "next/link";
import type { Metadata } from "next";
import { Clock, Download, Plus, Users } from "lucide-react";

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
import { hasDemoData, loadSettings, loadTeam } from "@/lib/finance/repository";
import { UserDialog } from "@/components/dialogs/user-dialog";
import { UserRowActions } from "@/components/finance/user-row-actions";
import {
  DeclinedRequestActions,
  PendingRequestActions,
} from "@/components/finance/pending-request-actions";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/finance/empty-state";
import { CASH_MOVEMENT_LABELS } from "@/lib/finance/labels";
import { signedCashMovement } from "@/lib/finance/engine";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await requirePageUser();
  const canManageUsers = can(viewer.role, "users:manage");
  const canManageSettings = can(viewer.role, "settings:manage");
  const canWrite = can(viewer.role, "finance:write");

  const [settings, movements, demoLoaded, team] = await Promise.all([
    loadSettings(),
    prisma.cashMovement.findMany({ orderBy: { occurredOn: "desc" } }),
    hasDemoData(),
    canManageUsers ? loadTeam() : Promise.resolve(null),
  ]);

  const today = toDateInputValue(todayInIST());
  const monthParam = formatMonthKey(currentMonthKey());

  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader
        title="Settings"
        description="Company details, cash-balance tracking, exports and your sign-in credentials."
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
        <>
          {team.pending.length > 0 ? (
            <Card id="requests" className="overflow-hidden border-warning/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="size-4 text-warning" />
                  Pending requests
                  <span className="rounded-full border border-warning/35 bg-warning-soft px-1.5 py-px font-mono text-[11px] text-warning">
                    {team.pending.length}
                  </span>
                </CardTitle>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  These people signed in with Clerk and are looking at a &ldquo;waiting for
                  approval&rdquo; screen. They see no data until you approve them with a role.
                </p>
              </CardHeader>
              <ul className="divide-y divide-border border-t border-border">
                {team.pending.map((request) => (
                  <li
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium">{request.name}</p>
                      <p className="font-mono tabular text-[12px] text-muted-foreground">
                        {request.email}
                      </p>
                      <p className="mt-0.5 text-[11px] text-faint-foreground">
                        Asked {formatDay(request.createdAt)}
                      </p>
                    </div>
                    <PendingRequestActions
                      userId={request.id}
                      name={request.name}
                      email={request.email}
                    />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card id="team" className="overflow-hidden">
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-4 text-faint-foreground" />
                  Team
                </CardTitle>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  Sign-in is handled by Clerk; access is decided here, in the database. A role
                  change takes effect on that person&rsquo;s very next request.
                </p>
              </div>
              <UserDialog>
                <Button size="sm">
                  <Plus />
                  Give access
                </Button>
              </UserDialog>
            </CardHeader>

            <TableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Last signed in</TableHead>
                    <TableHead className="hidden lg:table-cell">Approved by</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {team.members.map((member) => {
                    const isSelf = member.id === viewer.id;
                    const isLastSuperAdmin =
                      member.role === "SUPER_ADMIN" && member.isActive && team.activeSuperAdmins <= 1;
                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <span className="text-[13px] font-medium">
                            {member.name}
                            {isSelf ? (
                              <span className="ml-1.5 text-[11px] text-faint-foreground">you</span>
                            ) : null}
                          </span>
                          <span className="block font-mono tabular text-[12px] text-muted-foreground">
                            {member.email}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={member.role === "SUPER_ADMIN" ? "brand" : "default"}>
                            {ROLE_LABELS[member.role]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {!member.isActive ? (
                            <Badge variant="negative">Deactivated</Badge>
                          ) : member.clerkUserId ? (
                            <Badge variant="positive">Active</Badge>
                          ) : (
                            <Badge variant="outline">Not signed in yet</Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap font-mono tabular text-[13px] text-muted-foreground md:table-cell">
                          {member.lastLoginAt ? formatDay(member.lastLoginAt) : "—"}
                        </TableCell>
                        <TableCell className="hidden text-[13px] text-muted-foreground lg:table-cell">
                          {member.approvedBy?.name ?? "initial setup"}
                        </TableCell>
                        <TableCell>
                          <UserRowActions
                            isActive={member.isActive}
                            isSelf={isSelf}
                            isLastSuperAdmin={isLastSuperAdmin}
                            user={{
                              id: member.id,
                              name: member.name,
                              email: member.email,
                              role: member.role,
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableWrap>
          </Card>

          {team.declined.length > 0 ? (
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Declined requests</CardTitle>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Kept so they don&rsquo;t reappear every time that person signs in.
                </p>
              </CardHeader>
              <ul className="divide-y divide-border border-t border-border">
                {team.declined.map((request) => (
                  <li
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium">{request.name}</p>
                      <p className="font-mono tabular text-[12px] text-muted-foreground">
                        {request.email}
                      </p>
                    </div>
                    <DeclinedRequestActions userId={request.id} name={request.name} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
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
