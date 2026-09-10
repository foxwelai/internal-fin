"use client";

import * as React from "react";

import { recordCommissionPayment } from "@/app/actions/commissions";
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
import {
  Field,
  FormAlert,
  FormReadout,
  MoneyInput,
  SubmitButton,
} from "@/components/finance/form-kit";
import { useActionDialog } from "@/components/finance/use-action-dialog";
import { useFormDraft } from "@/components/finance/use-form-draft";
import { DraftNotice } from "@/components/finance/draft-notice";
import { Money } from "@/components/finance/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/finance/labels";
import { PAYMENT_METHODS } from "@/lib/finance/types";
import { formatForCsv } from "@/lib/money";

export function CommissionPaymentDialog({
  children,
  projectId,
  payee,
  duePaise,
  paidPaise,
  today,
}: {
  children: React.ReactNode;
  projectId: string;
  payee: string | null;
  duePaise: number;
  paidPaise: number;
  today: string;
}) {
  const { formRef, restored, clear, discard } = useFormDraft(`commission-payment:${projectId}`);
  const { state, formAction, pending, open, setOpen } = useActionDialog(recordCommissionPayment, {
    onSuccess: clear,
  });

  const outstanding = duePaise - paidPaise;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay commission{payee ? ` to ${payee}` : ""}</DialogTitle>
          <DialogDescription>
            Commission is earned as the client pays, so only what has been collected can be paid out.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} ref={formRef} className="contents">
          <input type="hidden" name="projectId" value={projectId} />

          <DialogBody className="space-y-4">
            <DraftNotice restored={restored} onDiscard={discard} />
            <FormAlert state={state} />

            <div className="grid gap-2 sm:grid-cols-3">
              <FormReadout
                label="Earned so far"
                value={<Money value={BigInt(duePaise)} className="text-[13px]" />}
              />
              <FormReadout
                label="Already paid"
                value={<Money value={BigInt(paidPaise)} className="text-[13px]" />}
              />
              <FormReadout
                label="Owed"
                value={<Money value={BigInt(outstanding)} className="text-[13px]" />}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="amount" label="Amount paid" required errors={state.fieldErrors}>
                {(props) => (
                  <MoneyInput
                    {...props}
                    defaultValue={outstanding > 0 ? formatForCsv(BigInt(outstanding)) : ""}
                    required
                    autoFocus
                  />
                )}
              </Field>
              <Field name="paidOn" label="Payment date" required errors={state.fieldErrors}>
                {(props) => <Input {...props} type="date" defaultValue={today} required />}
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className="text-[13px] font-medium leading-none text-muted-foreground">
                  Method
                </span>
                <select
                  name="method"
                  defaultValue="BANK_TRANSFER"
                  className="flex h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground hover:border-border-strong focus-visible:border-brand-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {PAYMENT_METHOD_LABELS[method]}
                    </option>
                  ))}
                </select>
              </div>
              <Field name="reference" label="Reference" errors={state.fieldErrors}>
                {(props) => <Input {...props} placeholder="UTR / cheque no." />}
              </Field>
            </div>

            <Field name="notes" label="Notes" errors={state.fieldErrors}>
              {(props) => <Textarea {...props} rows={2} />}
            </Field>
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pending={pending} disabled={pending || outstanding <= 0}>
              Record payment
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
