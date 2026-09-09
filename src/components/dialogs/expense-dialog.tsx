"use client";

import * as React from "react";

import { saveExpense } from "@/app/actions/expenses";
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
import { Switch } from "@/components/ui/switch";
import { Field, FormAlert, MoneyInput, SubmitButton } from "@/components/finance/form-kit";
import { useActionDialog } from "@/components/finance/use-action-dialog";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/finance/labels";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/finance/types";
import { formatForCsv } from "@/lib/money";

export type ExpenseInitial = {
  id: string;
  name: string;
  category: ExpenseCategory;
  plannedPaise: number;
  month: string;
  dueDate: string | null;
  isRecurring: boolean;
  notes: string | null;
};

export function ExpenseDialog({
  children,
  month,
  initial,
}: {
  children: React.ReactNode;
  /** Default month, "YYYY-MM". */
  month: string;
  initial?: ExpenseInitial;
}) {
  const { state, formAction, pending, open, setOpen } = useActionDialog(saveExpense);
  const [recurring, setRecurring] = React.useState(initial?.isRecurring ?? false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit expense" : "Add a monthly expense"}</DialogTitle>
          <DialogDescription>
            A budget line for one month. Cash leaving the account is recorded separately, so a bill
            paid late still lands in the month it was actually paid.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="contents">
          {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
          {recurring ? <input type="hidden" name="isRecurring" value="on" /> : null}

          <DialogBody className="space-y-4">
            <FormAlert state={state} />

            <Field name="name" label="Expense name" required errors={state.fieldErrors}>
              {(props) => (
                <Input
                  {...props}
                  defaultValue={initial?.name ?? ""}
                  placeholder="Office rent"
                  required
                  autoFocus
                />
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className="text-[13px] font-medium leading-none text-muted-foreground">
                  Category <span className="text-brand">*</span>
                </span>
                <select
                  name="category"
                  defaultValue={initial?.category ?? "MISC"}
                  className="flex h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground hover:border-border-strong focus-visible:border-brand-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
                >
                  {EXPENSE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {EXPENSE_CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </select>
              </div>

              <Field name="planned" label="Planned amount" required errors={state.fieldErrors}>
                {(props) => (
                  <MoneyInput
                    {...props}
                    defaultValue={initial ? formatForCsv(BigInt(initial.plannedPaise)) : ""}
                    placeholder="65,000"
                    required
                  />
                )}
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="month"
                label="Budget month"
                required
                errors={state.fieldErrors}
                hint="Which month this cost belongs to."
              >
                {(props) => (
                  <Input {...props} type="month" defaultValue={initial?.month ?? month} required />
                )}
              </Field>
              <Field name="dueDate" label="Due date" errors={state.fieldErrors}>
                {(props) => <Input {...props} type="date" defaultValue={initial?.dueDate ?? ""} />}
              </Field>
            </div>

            <label className="flex items-start justify-between gap-4 rounded-md border border-border bg-surface-2 px-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">Recurring cost</span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">
                  Marks this line as a monthly cost. To generate it automatically each month, create
                  a template on the Expenses page.
                </span>
              </span>
              <Switch checked={recurring} onCheckedChange={setRecurring} aria-label="Recurring cost" />
            </label>

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
            <SubmitButton pending={pending}>{initial ? "Save changes" : "Add expense"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
