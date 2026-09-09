"use client";

import * as React from "react";

import { recordExpensePayment } from "@/app/actions/expenses";
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
import { Money } from "@/components/finance/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/finance/labels";
import { PAYMENT_METHODS } from "@/lib/finance/types";
import { formatForCsv } from "@/lib/money";

export function ExpensePaymentDialog({
  children,
  expenseId,
  expenseName,
  plannedPaise,
  paidPaise,
  today,
}: {
  children: React.ReactNode;
  expenseId: string;
  expenseName: string;
  plannedPaise: number;
  paidPaise: number;
  today: string;
}) {
  const { state, formAction, pending, open, setOpen } = useActionDialog(recordExpensePayment);
  const outstanding = BigInt(plannedPaise) - BigInt(paidPaise);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            Cash leaving the account for {expenseName}. The date you enter decides which month&rsquo;s
            outflow it counts towards.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="contents">
          <input type="hidden" name="expenseId" value={expenseId} />

          <DialogBody className="space-y-4">
            <FormAlert state={state} />

            <div className="grid gap-2 sm:grid-cols-3">
              <FormReadout
                label="Planned"
                value={<Money value={BigInt(plannedPaise)} className="text-[13px]" />}
              />
              <FormReadout
                label="Paid so far"
                value={<Money value={BigInt(paidPaise)} className="text-[13px]" />}
              />
              <FormReadout
                label="Outstanding"
                value={<Money value={outstanding} className="text-[13px]" />}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="amount"
                label="Amount paid"
                required
                errors={state.fieldErrors}
                hint="Partial payments are fine."
              >
                {(props) => (
                  <MoneyInput
                    {...props}
                    defaultValue={outstanding > 0n ? formatForCsv(outstanding) : ""}
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
            <SubmitButton pending={pending}>Record payment</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
