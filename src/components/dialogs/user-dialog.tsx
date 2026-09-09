"use client";

import * as React from "react";

import { createUser, resetUserPassword, updateUser } from "@/app/actions/users";
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

export function UserDialog({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial?: UserInitial;
}) {
  const editing = Boolean(initial);
  const { state, formAction, pending, open, setOpen } = useActionDialog(
    editing ? updateUser : createUser,
  );
  const [role, setRole] = React.useState<UserRole>(initial?.role ?? "VIEWER");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${initial!.name}` : "Add someone to the team"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Changing a role takes effect on their very next request — they do not need to sign out."
              : "Accounts live in the database, not in configuration. Set a temporary password and ask them to change it once they are in."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="contents">
          {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
          <input type="hidden" name="role" value={role} />

          <DialogBody className="space-y-4">
            <FormAlert state={state} />

            <Field name="name" label="Name" required errors={state.fieldErrors}>
              {(props) => (
                <Input
                  {...props}
                  defaultValue={initial?.name ?? ""}
                  placeholder="Ananya Rao"
                  required
                  autoFocus
                />
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
                  <Input
                    {...props}
                    type="email"
                    autoComplete="off"
                    defaultValue=""
                    placeholder="ananya@foxwel.ai"
                    required
                  />
                )}
              </Field>
            )}

            <div className="space-y-1.5">
              <span className="text-[13px] font-medium leading-none text-muted-foreground">
                Role <span className="text-brand">*</span>
              </span>
              <div className="space-y-1.5">
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
                      onChange={() => setRole(option)}
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
              {state.fieldErrors?.role ? (
                <p className="text-[12px] text-negative">{state.fieldErrors.role[0]}</p>
              ) : null}
            </div>

            {editing ? null : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  name="password"
                  label="Temporary password"
                  required
                  errors={state.fieldErrors}
                  hint="At least 12 characters."
                >
                  {(props) => (
                    <Input {...props} type="password" autoComplete="new-password" required />
                  )}
                </Field>
                <Field
                  name="confirmPassword"
                  label="Confirm password"
                  required
                  errors={state.fieldErrors}
                >
                  {(props) => (
                    <Input {...props} type="password" autoComplete="new-password" required />
                  )}
                </Field>
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pending={pending}>
              {editing ? "Save changes" : "Create account"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ResetPasswordDialog({
  children,
  userId,
  userName,
}: {
  children: React.ReactNode;
  userId: string;
  userName: string;
}) {
  const { state, formAction, pending, open, setOpen } = useActionDialog(resetUserPassword);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password for {userName}</DialogTitle>
          <DialogDescription>
            Sets a new password immediately. Their existing sessions stay valid until they expire —
            deactivate and reactivate the account to end those at once.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="contents">
          <input type="hidden" name="id" value={userId} />
          <DialogBody className="space-y-4">
            <FormAlert state={state} />
            <Field
              name="password"
              label="New password"
              required
              errors={state.fieldErrors}
              hint="At least 12 characters."
            >
              {(props) => (
                <Input {...props} type="password" autoComplete="new-password" required autoFocus />
              )}
            </Field>
            <Field name="confirmPassword" label="Confirm password" required errors={state.fieldErrors}>
              {(props) => <Input {...props} type="password" autoComplete="new-password" required />}
            </Field>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pending={pending}>Reset password</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
