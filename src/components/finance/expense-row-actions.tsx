"use client";

import * as React from "react";
import { Archive, ArchiveRestore, Banknote, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExpenseDialog, type ExpenseInitial } from "@/components/dialogs/expense-dialog";
import { ExpensePaymentDialog } from "@/components/dialogs/expense-payment-dialog";
import { ConfirmAction } from "@/components/finance/confirm-action";
import { deleteExpense, setExpenseArchived } from "@/app/actions/expenses";

export function ExpenseRowActions({
  expense,
  paidPaise,
  paymentCount,
  archived,
  today,
}: {
  expense: ExpenseInitial;
  paidPaise: number;
  paymentCount: number;
  archived: boolean;
  today: string;
}) {
  const [confirm, setConfirm] = React.useState<null | "archive" | "delete">(null);
  const editTrigger = React.useRef<HTMLButtonElement>(null);
  const payTrigger = React.useRef<HTMLButtonElement>(null);

  const outstanding = expense.plannedPaise - paidPaise;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${expense.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={outstanding <= 0}
            onSelect={() => setTimeout(() => payTrigger.current?.click(), 0)}
          >
            <Banknote />
            Record payment
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTimeout(() => editTrigger.current?.click(), 0)}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTimeout(() => setConfirm("archive"), 0)}>
            {archived ? <ArchiveRestore /> : <Archive />}
            {archived ? "Restore" : "Archive"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setTimeout(() => setConfirm("delete"), 0)}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ExpenseDialog month={expense.month} initial={expense}>
        <button type="button" ref={editTrigger} className="sr-only" aria-hidden tabIndex={-1} />
      </ExpenseDialog>

      <ExpensePaymentDialog
        expenseId={expense.id}
        expenseName={expense.name}
        plannedPaise={expense.plannedPaise}
        paidPaise={paidPaise}
        today={today}
      >
        <button type="button" ref={payTrigger} className="sr-only" aria-hidden tabIndex={-1} />
      </ExpensePaymentDialog>

      <ConfirmAction
        open={confirm === "archive"}
        onOpenChange={(open) => setConfirm(open ? "archive" : null)}
        action={setExpenseArchived}
        hidden={{ id: expense.id, archive: archived ? "false" : "true" }}
        title={archived ? `Restore ${expense.name}?` : `Archive ${expense.name}?`}
        description={
          archived
            ? "It returns to the month's budget and counts towards planned expenses again."
            : "It stops counting towards this month's planned expenses. Payments already recorded stay in the cash outflow for the months they were made."
        }
        confirmLabel={archived ? "Restore" : "Archive"}
      />

      <ConfirmAction
        open={confirm === "delete"}
        onOpenChange={(open) => setConfirm(open ? "delete" : null)}
        action={deleteExpense}
        hidden={{ id: expense.id }}
        title={`Delete ${expense.name}?`}
        description={
          paymentCount > 0
            ? `This expense has ${paymentCount} recorded payment${paymentCount === 1 ? "" : "s"}. Deletion will be refused so the cash outflow history is preserved — archive it instead.`
            : "This permanently removes the budget line. It cannot be undone."
        }
        confirmLabel="Delete permanently"
      />
    </>
  );
}
