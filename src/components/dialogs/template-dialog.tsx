"use client";

import * as React from "react";

import { saveTemplate } from "@/app/actions/expenses";
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

export type TemplateInitial = {
  id: string;
  name: string;
  category: ExpenseCategory;
  amountPaise: number;
  dueDayOfMonth: number | null;
  isActive: boolean;
  notes: string | null;
};

export function TemplateDialog({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial?: TemplateInitial;
}) {
  const { state, formAction, pending, open, setOpen } = useActionDialog(saveTemplate);
  const [active, setActive] = React.useState(initial?.isActive ?? true);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit template" : "New recurring template"}</DialogTitle>
          <DialogDescription>
            A blueprint for a monthly cost. Each month it generates one independent expense line —
            editing the template afterwards never rewrites months already generated.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="contents">
          {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
          {active ? <input type="hidden" name="isActive" value="on" /> : null}

          <DialogBody className="space-y-4">
            <FormAlert state={state} />

            <Field name="name" label="Template name" required errors={state.fieldErrors}>
              {(props) => (
                <Input {...props} defaultValue={initial?.name ?? ""} placeholder="Salaries" required autoFocus />
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

              <Field name="amount" label="Monthly amount" required errors={state.fieldErrors}>
                {(props) => (
                  <MoneyInput
                    {...props}
                    defaultValue={initial ? formatForCsv(BigInt(initial.amountPaise)) : ""}
                    placeholder="3,60,000"
                    required
                  />
                )}
              </Field>
            </div>

            <Field
              name="dueDayOfMonth"
              label="Due day of month"
              errors={state.fieldErrors}
              hint="1–31. Clamped automatically in shorter months, so 31 becomes 28 in February."
            >
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={1}
                  max={31}
                  defaultValue={initial?.dueDayOfMonth ?? ""}
                  placeholder="5"
                  className="max-w-[8rem]"
                />
              )}
            </Field>

            <label className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface-2 px-3 py-2.5">
              <span>
                <span className="block text-[13px] font-medium">Active</span>
                <span className="mt-0.5 block text-[12px] text-muted-foreground">
                  Inactive templates are skipped when generating a month.
                </span>
              </span>
              <Switch checked={active} onCheckedChange={setActive} aria-label="Template active" />
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
            <SubmitButton pending={pending}>{initial ? "Save template" : "Create template"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
