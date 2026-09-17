"use client";

import * as React from "react";

import { addUser } from "@/app/actions/users";
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
import { Field, FormAlert, SubmitButton } from "@/components/finance/form-kit";
import { useActionDialog } from "@/components/finance/use-action-dialog";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_ORDER } from "@/lib/permissions";
import type { UserRole } from "@/generated/prisma";

/** The three roles as choosable cards, so the consequence is read before it is picked. */
function RolePicker({
  role,
  onChange,
  error,
}: {
  role: UserRole;
  onChange: (role: UserRole) => void;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-[13px] font-medium leading-none text-muted-foreground">
        Role <span className="text-brand">*</span>
      </span>
      <div className="space-y-1.5" role="radiogroup" aria-label="Role">
        {ROLE_ORDER.map((option) => (
          <label
            key={option}
            className={
              role === option
                ? "flex cursor-pointer items-start gap-2.5 rounded-md border border-brand-line bg-brand-soft px-3 py-2.5"
                : "flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-surface-2 px-3 py-2.5 hover:border-border-strong"
            }
          >
            <input
              type="radio"
              name="roleChoice"
              value={option}
              checked={role === option}
              onChange={() => onChange(option)}
              className="mt-0.5 size-3.5 accent-[var(--brand)]"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium">{ROLE_LABELS[option]}</span>
              <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">
                {ROLE_DESCRIPTIONS[option]}
              </span>
            </span>
          </label>
        ))}
      </div>
      {error ? <p className="text-[12px] text-negative">{error}</p> : null}
    </div>
  );
}

/**
 * Give someone access before they have signed up. They get straight in with
 * this role the first time they sign in with this email, once Clerk has
 * verified it. People who already signed up are handled from the list instead.
 */
export function UserDialog({ children }: { children: React.ReactNode }) {
  const { state, formAction, pending, open, setOpen } = useActionDialog(addUser);
  const [role, setRole] = React.useState<UserRole>("VIEWER");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite by email</DialogTitle>
          <DialogDescription>
            For someone who hasn&rsquo;t signed up yet. When they sign up with this email they get
            straight in with this role — Clerk verifies the address first, so nobody else can claim
            it.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="contents">
          <input type="hidden" name="role" value={role} />

          <DialogBody className="space-y-4">
            <FormAlert state={state} />

            <Field name="name" label="Name" required errors={state.fieldErrors}>
              {(props) => <Input {...props} placeholder="Ananya Rao" required autoFocus />}
            </Field>

            <Field name="email" label="Email" required errors={state.fieldErrors}>
              {(props) => (
                <Input {...props} type="email" autoComplete="off" placeholder="ananya@foxwel.ai" required />
              )}
            </Field>

            <RolePicker role={role} onChange={setRole} error={state.fieldErrors?.role?.[0]} />
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pending={pending}>Invite</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
