"use client";

import * as React from "react";

import { saveAsset } from "@/app/actions/assets";
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
import { BillPicker } from "@/components/finance/bill-picker";
import { useActionDialog } from "@/components/finance/use-action-dialog";
import { useFormDraft } from "@/components/finance/use-form-draft";
import { DraftNotice } from "@/components/finance/draft-notice";
import { formatForCsv } from "@/lib/money";

export type AssetCategoryOption = { id: string; name: string };

export type AssetInitial = {
  id: string;
  name: string;
  categoryId: string;
  specification: string | null;
  serialNumber: string | null;
  purchasedOn: string | null;
  costPaise: number | null;
  notes: string | null;
  bill: { fileName: string } | null;
};

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground hover:border-border-strong focus-visible:border-brand-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35";

export function AssetDialog({
  children,
  categories,
  initial,
}: {
  children: React.ReactNode;
  categories: AssetCategoryOption[];
  initial?: AssetInitial;
}) {
  const { formRef, restored, clear, discard } = useFormDraft(`asset:${initial?.id ?? "new"}`);
  const { state, formAction, pending, open, setOpen } = useActionDialog(saveAsset, {
    onSuccess: clear,
  });
  const editing = Boolean(initial);
  const [category, setCategory] = React.useState(
    initial?.categoryId ?? (categories.length === 0 ? "new" : ""),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit asset" : "Add asset"}</DialogTitle>
          <DialogDescription>
            A register of what the company owns. The purchase itself is still recorded under
            expenses.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} ref={formRef} className="contents">
          {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

          <DialogBody className="space-y-4">
            <DraftNotice restored={restored} onDiscard={discard} />
            <FormAlert state={state} />

            <Field name="name" label="Asset" required errors={state.fieldErrors}>
              {(props) => (
                <Input
                  {...props}
                  defaultValue={initial?.name ?? ""}
                  placeholder="Mac mini M5"
                  required
                  autoFocus
                />
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="categoryId" label="Category" required errors={state.fieldErrors}>
                {(props) => (
                  <select
                    {...props}
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="" disabled>
                      Choose a category
                    </option>
                    {categories.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                    <option value="new">+ New category…</option>
                  </select>
                )}
              </Field>

              <Field name="serialNumber" label="Serial number" errors={state.fieldErrors}>
                {(props) => (
                  <Input
                    {...props}
                    defaultValue={initial?.serialNumber ?? ""}
                    placeholder="C02XK1ABJG5J"
                    className="font-mono"
                  />
                )}
              </Field>
            </div>

            {category === "new" ? (
              <Field
                name="newCategory"
                label="New category name"
                required
                errors={state.fieldErrors}
                hint="Created when you save, and offered in the list from then on."
              >
                {(props) => <Input {...props} placeholder="Computers" autoComplete="off" required />}
              </Field>
            ) : null}

            <Field name="specification" label="Specification" errors={state.fieldErrors}>
              {(props) => (
                <Textarea
                  {...props}
                  defaultValue={initial?.specification ?? ""}
                  rows={3}
                  placeholder={"M5, 10-core CPU\n32GB unified memory, 1TB SSD"}
                />
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="purchasedOn" label="Purchased on" errors={state.fieldErrors}>
                {(props) => (
                  <Input {...props} type="date" defaultValue={initial?.purchasedOn ?? ""} />
                )}
              </Field>
              <Field name="cost" label="Cost" errors={state.fieldErrors}>
                {(props) => (
                  <MoneyInput
                    {...props}
                    defaultValue={
                      initial?.costPaise != null ? formatForCsv(BigInt(initial.costPaise)) : ""
                    }
                    placeholder="1,24,900"
                  />
                )}
              </Field>
            </div>

            <BillPicker
              existing={
                initial?.bill
                  ? { href: `/api/assets/${initial.id}/bill`, fileName: initial.bill.fileName }
                  : null
              }
              error={state.fieldErrors?.bill?.[0]}
            />

            <Field name="notes" label="Notes" errors={state.fieldErrors}>
              {(props) => (
                <Textarea
                  {...props}
                  defaultValue={initial?.notes ?? ""}
                  rows={2}
                  placeholder="Who uses it, warranty until, where it's kept."
                />
              )}
            </Field>
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pending={pending}>{editing ? "Save changes" : "Add asset"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
