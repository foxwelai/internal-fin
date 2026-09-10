"use client";

import * as React from "react";
import { Banknote, CircleCheck, MoreHorizontal, Pencil, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoanDialog, LoanPaymentDialog, type LoanInitial } from "@/components/dialogs/loan-dialog";
import { ConfirmAction } from "@/components/finance/confirm-action";
import { deleteLoan, setLoanStatus } from "@/app/actions/loans";

export function LoanRowActions({
  loan,
  outstandingPaise,
  paymentCount,
  isClosed,
  today,
}: {
  loan: LoanInitial;
  outstandingPaise: number;
  paymentCount: number;
  isClosed: boolean;
  today: string;
}) {
  const [confirm, setConfirm] = React.useState<null | "status" | "delete">(null);
  const editTrigger = React.useRef<HTMLButtonElement>(null);
  const payTrigger = React.useRef<HTMLButtonElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${loan.lender}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            disabled={outstandingPaise <= 0}
            onSelect={() => setTimeout(() => payTrigger.current?.click(), 0)}
          >
            <Banknote />
            Record repayment
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTimeout(() => editTrigger.current?.click(), 0)}>
            <Pencil />
            Edit loan
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setTimeout(() => setConfirm("status"), 0)}>
            {isClosed ? <RotateCcw /> : <CircleCheck />}
            {isClosed ? "Reopen" : "Mark closed"}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setTimeout(() => setConfirm("delete"), 0)}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LoanDialog initial={loan} today={today}>
        <button type="button" ref={editTrigger} className="sr-only" aria-hidden tabIndex={-1} />
      </LoanDialog>

      <LoanPaymentDialog
        loanId={loan.id}
        lender={loan.lender}
        outstandingPaise={outstandingPaise}
        today={today}
      >
        <button type="button" ref={payTrigger} className="sr-only" aria-hidden tabIndex={-1} />
      </LoanPaymentDialog>

      <ConfirmAction
        open={confirm === "status"}
        onOpenChange={(next) => setConfirm(next ? "status" : null)}
        action={setLoanStatus}
        hidden={{ id: loan.id, close: isClosed ? "false" : "true" }}
        title={isClosed ? `Reopen ${loan.lender}?` : `Mark ${loan.lender} closed?`}
        description={
          isClosed
            ? "It counts towards borrowing outstanding again."
            : "It drops out of borrowing outstanding. Repayments already recorded stay in the cash history."
        }
        confirmLabel={isClosed ? "Reopen" : "Mark closed"}
      />

      <ConfirmAction
        open={confirm === "delete"}
        onOpenChange={(next) => setConfirm(next ? "delete" : null)}
        action={deleteLoan}
        hidden={{ id: loan.id }}
        title={`Delete ${loan.lender}?`}
        description={
          paymentCount > 0
            ? `This loan has ${paymentCount} recorded repayment${paymentCount === 1 ? "" : "s"}. Deletion will be refused — mark it closed instead so the cash history survives.`
            : "This permanently removes the loan. It cannot be undone."
        }
        confirmLabel="Delete permanently"
      />
    </>
  );
}
