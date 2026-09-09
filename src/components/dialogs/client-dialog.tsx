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

export type ClientInitial = {
  id: string;
  name: string;
  contactPerson: string | null;
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
  const { state, formAction, pending, open, setOpen } = useActionDialog(saveClient);
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

        <form action={formAction} className="contents">
          {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

          <DialogBody className="space-y-4">
            <FormAlert state={state} />

            <Field name="name" label="Client or company name" required errors={state.fieldErrors}>
              {(props) => (
                <Input
                  {...props}
                  defaultValue={initial?.name ?? ""}
                  placeholder="Northwind Retail Pvt Ltd"
                  required
                  autoFocus
                />
              )}
            </Field>

            <Field name="contactPerson" label="Contact person" errors={state.fieldErrors}>
              {(props) => (
                <Input {...props} defaultValue={initial?.contactPerson ?? ""} placeholder="Ananya Rao" />
              )}
            </Field>

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
              <Field name="phone" label="Phone" errors={state.fieldErrors}>
                {(props) => (
                  <Input {...props} defaultValue={initial?.phone ?? ""} placeholder="+91 98200 41122" />
                )}
              </Field>
            </div>

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
