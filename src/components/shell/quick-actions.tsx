"use client";

import * as React from "react";
import { FolderPlus, Plus, Receipt, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectDialog } from "@/components/dialogs/project-dialog";
import { ReceiptDialog } from "@/components/dialogs/receipt-dialog";
import { ExpenseDialog } from "@/components/dialogs/expense-dialog";
import type { ClientOption, ProjectOption } from "@/components/finance/options";
import { useCan } from "@/components/auth/permission-provider";
import { useSelectedMonthParam } from "@/components/shell/use-selected-month";
import type { MonthKey } from "@/lib/dates";

/**
 * The three things this business does daily: win work, get paid, pay bills.
 * On desktop they sit in the top bar; on mobile they collapse into one button
 * so the header stays legible on a phone.
 */
export function QuickActions({
  clients,
  projects,
  fallbackMonth,
  today,
}: {
  clients: ClientOption[];
  projects: ProjectOption[];
  fallbackMonth: MonthKey;
  today: string;
}) {
  const month = useSelectedMonthParam(fallbackMonth);
  const canWrite = useCan("finance:write");
  // One set of dialogs serves both layouts. On desktop their triggers are the
  // visible buttons; on mobile the menu clicks the same triggers, deferred by a
  // tick so Radix has finished closing the menu and restoring focus first.
  const projectTrigger = React.useRef<HTMLButtonElement>(null);
  const receiptTrigger = React.useRef<HTMLButtonElement>(null);
  const expenseTrigger = React.useRef<HTMLButtonElement>(null);

  const openAfterMenuCloses = (trigger: React.RefObject<HTMLButtonElement | null>) => {
    setTimeout(() => trigger.current?.click(), 0);
  };

  // A read-only account gets no create buttons at all — the server would
  // refuse the action anyway, so offering it would only mislead.
  if (!canWrite) return null;

  return (
    <>
      {/* Tablet and up — the secondary actions shrink to icons until there is
          room for their labels beside an open sidebar. */}
      <div className="hidden items-center gap-2 md:flex">
        <ReceiptDialog projects={projects} today={today}>
          <Button size="sm" ref={receiptTrigger}>
            <Wallet />
            Record payment
          </Button>
        </ReceiptDialog>
        <ProjectDialog clients={clients}>
          <Button size="sm" variant="secondary" ref={projectTrigger} title="New project">
            <FolderPlus />
            <span className="sr-only xl:not-sr-only">New project</span>
          </Button>
        </ProjectDialog>
        <ExpenseDialog month={month}>
          <Button size="sm" variant="secondary" ref={expenseTrigger} title="Add expense">
            <Receipt />
            <span className="sr-only xl:not-sr-only">Add expense</span>
          </Button>
        </ExpenseDialog>
      </div>

      {/* Mobile — the menu clicks the same triggers, which stay mounted. */}
      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" aria-label="Quick actions">
              <Plus />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => openAfterMenuCloses(receiptTrigger)}>
              <Wallet />
              Record payment
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openAfterMenuCloses(projectTrigger)}>
              <FolderPlus />
              New project
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openAfterMenuCloses(expenseTrigger)}>
              <Receipt />
              Add expense
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
