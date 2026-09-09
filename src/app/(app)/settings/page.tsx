import Link from "next/link";
import type { Metadata } from "next";
import { Download, Plus, ShieldCheck, Users } from "lucide-react";

import { PageHeader } from "@/components/finance/page-header";
import { Money } from "@/components/finance/money";
import { CashMovementDialog } from "@/components/dialogs/cash-movement-dialog";
import {
  CashMovementRowActions,
  CompanySettingsForm,
  DemoDataControls,
  PasswordForm,
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

import { requireUser } from "@/lib/auth";
import { can, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/finance/empty-state";
import { CASH_MOVEMENT_LABELS } from "@/lib/finance/labels";
import { signedCashMovement } from "@/lib/finance/engine";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await requireUser();
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
        <Card id="team" className="overflow-hidden">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4 text-faint-foreground" />
                Team
              </CardTitle>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Accounts live in the database and are managed here — nothing about who may do what
                is baked into the code or an environment variable. A role change takes effect on
                that person&rsquo;s very next request.
              </p>
            </div>
            <UserDialog>
              <Button size="sm">
                <Plus />
                Add person
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
                  <TableHead className="hidden lg:table-cell">Added by</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.users.map((member) => {
                  const isSelf = member.id === viewer.id;
                  const isLastActiveOwner =
                    member.role === "OWNER" && member.isActive && team.activeOwners <= 1;
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
                        <Badge variant={member.role === "OWNER" ? "brand" : "default"}>
                          {ROLE_LABELS[member.role]}
                        </Badge>
                        <span className="mt-1 block max-w-[18rem] text-[11px] leading-snug text-faint-foreground">
                          {ROLE_DESCRIPTIONS[member.role]}
                        </span>
                      </TableCell>
                      <TableCell>
                        {member.isActive ? (
                          <Badge variant="positive">Active</Badge>
                        ) : (
                          <Badge variant="negative">Deactivated</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap font-mono tabular text-[13px] text-muted-foreground md:table-cell">
                        {member.lastLoginAt ? formatDay(member.lastLoginAt) : "never"}
                      </TableCell>
                      <TableCell className="hidden text-[13px] text-muted-foreground lg:table-cell">
                        {member.createdBy?.name ?? "initial setup"}
                      </TableCell>
                      <TableCell>
                        <UserRowActions
                          isActive={member.isActive}
                          isSelf={isSelf}
                          isLastActiveOwner={isLastActiveOwner}
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

          {team.users.length === 1 ? (
            <CardContent className="pt-4">
              <EmptyState
                icon={ShieldCheck}
                title="You are the only account"
                description="Add colleagues with the role that fits: an Admin records money but cannot manage people, a Viewer can only look."
                compact
              />
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      {/* ------------------------------ Account ---------------------------- */}

      <Card id="account">
        <CardHeader>
          <CardTitle>Your account</CardTitle>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Signed in as <span className="text-foreground">{viewer.email}</span>, with the role{" "}
            <span className="text-foreground">{ROLE_LABELS[viewer.role]}</span> —{" "}
            {ROLE_DESCRIPTIONS[viewer.role].charAt(0).toLowerCase() +
              ROLE_DESCRIPTIONS[viewer.role].slice(1)}{" "}
            Accounts are created by an owner on this page; there is no self sign-up.
          </p>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
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
