"use client";

import * as React from "react";

import { recordLoanPayment, saveLoan } from "@/app/actions/loans";
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

export type LoanInitial = {
  id: string;
  lender: string;
  principalPaise: number;
  interestRateBps: number | null;
  receivedOn: string;
  dueDate: string | null;
  reference: string | null;
  notes: string | null;
};

export function LoanDialog({
  children,
  initial,
  today,
}: {
  children: React.ReactNode;
  initial?: LoanInitial;
  today: string;
}) {
  const { formRef, restored, clear, discard } = useFormDraft(`loan:${initial?.id ?? "new"}`);
  const { state, formAction, pending, open, setOpen } = useActionDialog(saveLoan, {
    onSuccess: clear,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? `Edit ${initial.lender}` : "Record a loan"}</DialogTitle>
          <DialogDescription>
            Money borrowed by the business. The principal arriving and every repayment move the cash
            balance — neither is income or expense, so the operating surplus is untouched.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} ref={formRef} className="contents">
          {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

          <DialogBody className="space-y-4">
            <DraftNotice restored={restored} onDiscard={discard} />
            <FormAlert state={state} />

            <Field name="lender" label="Lender" required errors={state.fieldErrors}>
              {(props) => (
                <Input
                  {...props}
                  defaultValue={initial?.lender ?? ""}
                  placeholder="HDFC working capital line"
                  required
                  autoFocus
                />
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="principal" label="Principal" required errors={state.fieldErrors}>
                {(props) => (
                  <MoneyInput
                    {...props}
                    defaultValue={initial ? formatForCsv(BigInt(initial.principalPaise)) : ""}
                    placeholder="5,00,000"
                    required
                  />
                )}
              </Field>
              <Field
                name="interestPercent"
                label="Interest rate"
                errors={state.fieldErrors}
                hint="Per year. Recorded for reference — repayments are entered as they happen."
              >
                {(props) => (
                  <div className="relative">
                    <Input
                      {...props}
                      inputMode="decimal"
                      defaultValue={initial?.interestRateBps ? String(initial.interestRateBps / 100) : ""}
                      placeholder="12.5"
                      className="pr-7 font-mono tabular"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[13px] text-faint-foreground">
                      %
                    </span>
                  </div>
                )}
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="receivedOn" label="Date received" required errors={state.fieldErrors}>
                {(props) => (
                  <Input {...props} type="date" defaultValue={initial?.receivedOn ?? today} required />
                )}
              </Field>
              <Field name="dueDate" label="Repay by" errors={state.fieldErrors}>
                {(props) => <Input {...props} type="date" defaultValue={initial?.dueDate ?? ""} />}
              </Field>
            </div>

            <Field name="reference" label="Reference" errors={state.fieldErrors}>
              {(props) => (
                <Input {...props} defaultValue={initial?.reference ?? ""} placeholder="Sanction / account no." />
              )}
            </Field>

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
            <SubmitButton pending={pending}>{initial ? "Save changes" : "Record loan"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LoanPaymentDialog({
  children,
  loanId,
  lender,
  outstandingPaise,
  today,
}: {
  children: React.ReactNode;
  loanId: string;
  lender: string;
  outstandingPaise: number;
  today: string;
}) {
  const { formRef, restored, clear, discard } = useFormDraft(`loan-payment:${loanId}`);
  const { state, formAction, pending, open, setOpen } = useActionDialog(recordLoanPayment, {
    onSuccess: clear,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record a repayment</DialogTitle>
          <DialogDescription>
            Cash going back to {lender}. It reduces the cash balance and the outstanding balance, and
            never appears as an expense.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} ref={formRef} className="contents">
          <input type="hidden" name="loanId" value={loanId} />

          <DialogBody className="space-y-4">
            <DraftNotice restored={restored} onDiscard={discard} />
            <FormAlert state={state} />

            <FormReadout
              label="Outstanding"
              value={<Money value={BigInt(outstandingPaise)} className="text-[13px]" />}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="amount" label="Repayment amount" required errors={state.fieldErrors}>
                {(props) => (
                  <MoneyInput
                    {...props}
                    defaultValue={outstandingPaise > 0 ? formatForCsv(BigInt(outstandingPaise)) : ""}
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
            <SubmitButton pending={pending}>Record repayment</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
