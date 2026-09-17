"use client";

import * as React from "react";

import { saveClient } from "@/app/actions/clients";
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
import { Field, FormAlert, SubmitButton } from "@/components/finance/form-kit";
import { useActionDialog } from "@/components/finance/use-action-dialog";
import { useFormDraft } from "@/components/finance/use-form-draft";
import { DraftNotice } from "@/components/finance/draft-notice";

export type ClientInitial = {
  id: string;
  name: string;
  companyName: string | null;
  clientName: string | null;
  website: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

export function ClientDialog({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial?: ClientInitial;
}) {
  const { formRef, restored, clear, discard } = useFormDraft(`client:${initial?.id ?? "new"}`);
  const { state, formAction, pending, open, setOpen } = useActionDialog(saveClient, {
    onSuccess: clear,
  });
  const editing = Boolean(initial);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit client" : "New client"}</DialogTitle>
          <DialogDescription>
            Clients are internal records. They have no login in this version.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} ref={formRef} className="contents">
          {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

          <DialogBody className="space-y-4">
            <DraftNotice restored={restored} onDiscard={discard} />
            <FormAlert state={state} />

            <Field name="name" label="Company name" required errors={state.fieldErrors}>
              {(props) => (
                <Input
                  {...props}
                  defaultValue={initial?.name ?? ""}
                  placeholder="Northwind Retail"
                  required
                  autoFocus
                />
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="clientName"
                label="Client name"
                required
                errors={state.fieldErrors}
                hint="The owner or decision maker."
              >
                {(props) => (
                  <Input
                    {...props}
                    defaultValue={initial?.clientName ?? ""}
                    placeholder="Rahul Shenoy"
                    autoComplete="off"
                    required
                  />
                )}
              </Field>
              <Field name="phone" label="Client phone" required errors={state.fieldErrors}>
                {(props) => (
                  <Input
                    {...props}
                    type="tel"
                    inputMode="tel"
                    defaultValue={initial?.phone ?? ""}
                    placeholder="+91 98200 41122"
                    required
                  />
                )}
              </Field>
            </div>

            <fieldset className="space-y-3 rounded-lg border border-border bg-surface-2/60 p-3">
              <legend className="px-1 text-[12px] font-medium text-muted-foreground">
                Point of contact
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  name="contactPerson"
                  label="Contact person"
                  required
                  errors={state.fieldErrors}
                >
                  {(props) => (
                    <Input
                      {...props}
                      defaultValue={initial?.contactPerson ?? ""}
                      placeholder="Ananya Rao"
                      autoComplete="off"
                      required
                    />
                  )}
                </Field>
                <Field name="contactPhone" label="Contact phone" required errors={state.fieldErrors}>
                  {(props) => (
                    <Input
                      {...props}
                      type="tel"
                      inputMode="tel"
                      defaultValue={initial?.contactPhone ?? ""}
                      placeholder="+91 99000 12345"
                      required
                    />
                  )}
                </Field>
              </div>
              <p className="text-[12px] leading-relaxed text-faint-foreground">
                Who the team calls day to day. Same as the client? Enter their details again.
              </p>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="email" label="Email" errors={state.fieldErrors}>
                {(props) => (
                  <Input
                    {...props}
                    type="email"
                    defaultValue={initial?.email ?? ""}
                    placeholder="ananya@example.com"
                  />
                )}
              </Field>
              <Field
                name="website"
                label="Website"
                errors={state.fieldErrors}
                hint="Domain is enough — foxwel.ai."
              >
                {(props) => (
                  <Input
                    {...props}
                    inputMode="url"
                    defaultValue={initial?.website ?? ""}
                    placeholder="northwind.example"
                  />
                )}
              </Field>
            </div>

            <Field
              name="companyName"
              label="Registered name"
              errors={state.fieldErrors}
              hint="Optional — the legal entity on invoices, if it differs from the company name."
            >
              {(props) => (
                <Input
                  {...props}
                  defaultValue={initial?.companyName ?? ""}
                  placeholder="Northwind Retail Pvt Ltd"
                />
              )}
            </Field>

            <Field name="notes" label="Notes" errors={state.fieldErrors}>
              {(props) => (
                <Textarea
                  {...props}
                  defaultValue={initial?.notes ?? ""}
                  placeholder="Payment cycle, billing contact, anything worth remembering."
                  rows={3}
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
            <SubmitButton pending={pending}>{editing ? "Save changes" : "Add client"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
