"use client";

import * as React from "react";

import { addUser, approveUser, updateUser } from "@/app/actions/users";
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

export type UserInitial = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

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

/** Add someone ahead of time, or change an existing member's name and role. */
export function UserDialog({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial?: UserInitial;
}) {
  const editing = Boolean(initial);
  const { state, formAction, pending, open, setOpen } = useActionDialog(
    editing ? updateUser : addUser,
  );
  const [role, setRole] = React.useState<UserRole>(initial?.role ?? "VIEWER");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${initial!.name}` : "Give someone access"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "A role change takes effect on their very next request — they do not need to sign out."
              : "They sign in with Clerk using this email and get straight in with this role. Clerk verifies the address first, so nobody else can claim it."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="contents">
          {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
          <input type="hidden" name="role" value={role} />

          <DialogBody className="space-y-4">
            <FormAlert state={state} />

            <Field name="name" label="Name" required errors={state.fieldErrors}>
              {(props) => (
                <Input {...props} defaultValue={initial?.name ?? ""} placeholder="Ananya Rao" required autoFocus />
              )}
            </Field>

            {editing ? (
              <div className="rounded-md border border-border bg-surface-2 px-3 py-2">
                <span className="text-[12px] text-muted-foreground">Email</span>
                <p className="font-mono tabular text-[13px]">{initial!.email}</p>
              </div>
            ) : (
              <Field name="email" label="Email" required errors={state.fieldErrors}>
                {(props) => (
                  <Input {...props} type="email" autoComplete="off" placeholder="ananya@foxwel.ai" required />
                )}
              </Field>
            )}

            <RolePicker role={role} onChange={setRole} error={state.fieldErrors?.role?.[0]} />
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pending={pending}>{editing ? "Save changes" : "Give access"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Approve a pending request — the role is chosen as part of saying yes. */
export function ApproveDialog({
  children,
  userId,
  name,
  email,
}: {
  children: React.ReactNode;
  userId: string;
  name: string;
  email: string;
}) {
  const { state, formAction, pending, open, setOpen } = useActionDialog(approveUser);
  const [role, setRole] = React.useState<UserRole>("VIEWER");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve {name}</DialogTitle>
          <DialogDescription>
            <span className="font-mono tabular">{email}</span> signed in and is waiting. Choose what
            they may do — Viewer is the safe default.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="contents">
          <input type="hidden" name="id" value={userId} />
          <input type="hidden" name="role" value={role} />

          <DialogBody className="space-y-4">
            <FormAlert state={state} />
            <RolePicker role={role} onChange={setRole} error={state.fieldErrors?.role?.[0]} />
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pending={pending}>Approve as {ROLE_LABELS[role]}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
