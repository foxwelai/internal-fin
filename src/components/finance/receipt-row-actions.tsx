"use client";

import * as React from "react";
import { Link2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReceiptDialog, type ReceiptInitial } from "@/components/dialogs/receipt-dialog";
import { AllocateDialog } from "@/components/dialogs/allocate-dialog";
import { ConfirmAction } from "@/components/finance/confirm-action";
import { deleteReceipt } from "@/app/actions/receipts";
import type { ProjectOption } from "@/components/finance/options";

export function ReceiptRowActions({
  receipt,
  project,
  today,
}: {
  receipt: ReceiptInitial;
  project: ProjectOption;
  today: string;
}) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const editTrigger = React.useRef<HTMLButtonElement>(null);
  const allocateTrigger = React.useRef<HTMLButtonElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Receipt actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setTimeout(() => allocateTrigger.current?.click(), 0)}>
            <Link2 />
            Match to schedule
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTimeout(() => editTrigger.current?.click(), 0)}>
            <Pencil />
            Edit receipt
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setTimeout(() => setConfirmDelete(true), 0)}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ReceiptDialog projects={[project]} initial={receipt} today={today}>
        <button type="button" ref={editTrigger} className="sr-only" aria-hidden tabIndex={-1} />
      </ReceiptDialog>

      <AllocateDialog
        receiptId={receipt.id}
        receiptAmountPaise={receipt.amountPaise}
        schedules={project.schedules}
        existing={receipt.allocations}
      >
        <button type="button" ref={allocateTrigger} className="sr-only" aria-hidden tabIndex={-1} />
      </AllocateDialog>

      <ConfirmAction
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        action={deleteReceipt}
        hidden={{ id: receipt.id }}
        title="Delete this receipt?"
        description="The money comes back out of collections for the month it was dated, and any milestones it was covering become unpaid again. This cannot be undone."
        confirmLabel="Delete receipt"
      />
    </>
  );
}
