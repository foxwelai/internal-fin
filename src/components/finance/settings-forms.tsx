"use client";

import * as React from "react";
import { toast } from "sonner";
import { Database, Loader2, MoreHorizontal, Pencil, Trash2, TriangleAlert } from "lucide-react";

import { saveSettings, deleteCashMovement } from "@/app/actions/settings";
import { loadDemoData, removeDemoData } from "@/app/actions/demo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Field, FormAlert, MoneyInput, SubmitButton } from "@/components/finance/form-kit";
import { useActionForm } from "@/components/finance/use-action-dialog";
import { ConfirmAction } from "@/components/finance/confirm-action";
import {
  CashMovementDialog,
  type CashMovementInitial,
} from "@/components/dialogs/cash-movement-dialog";

export function CompanySettingsForm({
  companyName,
  openingBalance,
  openingBalanceDate,
}: {
  companyName: string;
  openingBalance: string;
  openingBalanceDate: string;
}) {
  const { state, formAction, pending } = useActionForm(saveSettings);

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert state={state} />

      <Field name="companyName" label="Company name" required errors={state.fieldErrors}>
        {(props) => <Input {...props} defaultValue={companyName} required className="max-w-sm" />}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2 sm:max-w-xl">
        <Field
          name="openingBalance"
          label="Opening cash balance"
          errors={state.fieldErrors}
          hint="Leave blank to turn cash-balance tracking off."
        >
          {(props) => <MoneyInput {...props} defaultValue={openingBalance} placeholder="6,50,000" />}
        </Field>
        <Field
          name="openingBalanceDate"
          label="Effective from"
          errors={state.fieldErrors}
          hint="Only money dated on or after this counts towards the balance."
        >
          {(props) => <Input {...props} type="date" defaultValue={openingBalanceDate} />}
        </Field>
      </div>

      <SubmitButton pending={pending}>Save settings</SubmitButton>
    </form>
  );
}

export function CashMovementRowActions({
  movement,
  today,
}: {
  movement: CashMovementInitial;
  today: string;
}) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const editTrigger = React.useRef<HTMLButtonElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${movement.label}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setTimeout(() => editTrigger.current?.click(), 0)}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setTimeout(() => setConfirmDelete(true), 0)}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CashMovementDialog initial={movement} today={today}>
        <button type="button" ref={editTrigger} className="sr-only" aria-hidden tabIndex={-1} />
      </CashMovementDialog>

      <ConfirmAction
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        action={deleteCashMovement}
        hidden={{ id: movement.id }}
        title={`Delete "${movement.label}"?`}
        description="The cash balance is recalculated without it. Collections and expenses are unaffected."
        confirmLabel="Delete"
      />
    </>
  );
}

/**
 * Demo data is opt-in and reversible. Loading it never touches real records,
 * and removing it deletes only rows flagged as demo.
 */
export function DemoDataControls({ loaded }: { loaded: boolean }) {
  const [pending, startTransition] = React.useTransition();

  const run = (action: () => Promise<{ status: string; message?: string }>) => {
    startTransition(async () => {
      const result = await action();
      if (result.status === "success") toast.success(result.message ?? "Done.");
      else toast.error(result.message ?? "That did not work.");
    });
  };

  if (loaded) {
    return (
      <div className="space-y-3">
        <p className="flex items-start gap-2 rounded-md border border-info/30 bg-info-soft px-3 py-2.5 text-[13px] leading-relaxed text-info">
          <Database className="mt-px size-4 shrink-0" />
          <span>
            The demo dataset is loaded. Every one of its rows is flagged, so removing it leaves any
            real data you have entered untouched.
          </span>
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Remove demo data
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove the demo dataset?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes the five fictional clients, their projects, schedules, receipts,
                expenses, templates and cash movements. Anything you entered yourself is kept.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => run(removeDemoData)}>Remove it</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground">
        <TriangleAlert className="mt-px size-4 shrink-0 text-faint-foreground" />
        <span>
          Loads five fictional clients, ten projects and six months of expenses — advances, partial
          receipts, an unallocated payment and overdue invoices. Useful for seeing how the dashboard
          behaves before your own numbers are in.
        </span>
      </p>
      <Button size="sm" disabled={pending} onClick={() => run(loadDemoData)}>
        {pending ? <Loader2 className="animate-spin" /> : <Database />}
        Load demo data
      </Button>
    </div>
  );
}
