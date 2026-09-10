"use client";

import * as React from "react";

import { saveCashMovement } from "@/app/actions/settings";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormAlert, MoneyInput, SubmitButton } from "@/components/finance/form-kit";
import { useActionDialog } from "@/components/finance/use-action-dialog";
import { useFormDraft } from "@/components/finance/use-form-draft";
import { DraftNotice } from "@/components/finance/draft-notice";
import { CASH_MOVEMENT_LABELS } from "@/lib/finance/labels";
import { CASH_MOVEMENT_TYPES, type CashMovementType } from "@/lib/finance/types";
import { formatForCsv } from "@/lib/money";

export type CashMovementInitial = {
  id: string;
  type: CashMovementType;
  label: string;
  amountPaise: number;
  occurredOn: string;
  notes: string | null;
};

export function CashMovementDialog({
  children,
  initial,
  today,
}: {
  children: React.ReactNode;
  initial?: CashMovementInitial;
  today: string;
}) {
  const { formRef, restored, clear, discard } = useFormDraft(`cash-movement:${initial?.id ?? "new"}`);
  const { state, formAction, pending, open, setOpen } = useActionDialog(saveCashMovement, {
    onSuccess: clear,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit cash movement" : "Record a cash movement"}</DialogTitle>
          <DialogDescription>
            Funding, owner contributions, draws and transfers. These move the cash balance but are
            deliberately kept out of collections, expenses and the operating surplus.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} ref={formRef} className="contents">
          {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

          <DialogBody className="space-y-4">
            <DraftNotice restored={restored} onDiscard={discard} />
            <FormAlert state={state} />

            <div className="space-y-1.5">
              <span className="text-[13px] font-medium leading-none text-muted-foreground">
                Type <span className="text-brand">*</span>
              </span>
              <select
                name="type"
                defaultValue={initial?.type ?? "FUNDING"}
                className="flex h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground hover:border-border-strong focus-visible:border-brand-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
              >
                {CASH_MOVEMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {CASH_MOVEMENT_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            <Field name="label" label="Description" required errors={state.fieldErrors}>
              {(props) => (
                <Input
                  {...props}
                  defaultValue={initial?.label ?? ""}
                  placeholder="Working capital drawdown"
                  required
                />
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="amount" label="Amount" required errors={state.fieldErrors}>
                {(props) => (
                  <MoneyInput
                    {...props}
                    defaultValue={initial ? formatForCsv(BigInt(initial.amountPaise)) : ""}
                    placeholder="5,00,000"
                    required
                  />
                )}
              </Field>
              <Field name="occurredOn" label="Date" required errors={state.fieldErrors}>
                {(props) => (
                  <Input {...props} type="date" defaultValue={initial?.occurredOn ?? today} required />
                )}
              </Field>
            </div>

            <Field name="notes" label="Notes" errors={state.fieldErrors}>
              {(props) => <Textarea {...props} defaultValue={initial?.notes ?? ""} rows={2} />}
            </Field>
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pending={pending}>{initial ? "Save" : "Record movement"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
