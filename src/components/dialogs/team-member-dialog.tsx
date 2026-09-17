"use client";

import * as React from "react";

import { saveTeamMember } from "@/app/actions/team";
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
import { useFormDraft } from "@/components/finance/use-form-draft";
import { DraftNotice } from "@/components/finance/draft-notice";
import { TEAM_MEMBER_KINDS, type TeamMemberKind } from "@/lib/finance/types";
import { TEAM_MEMBER_KIND_LABELS } from "@/lib/finance/labels";
import { cn } from "@/lib/utils";

export type TeamMemberInitial = {
  id: string;
  kind: TeamMemberKind;
  name: string;
  phone: string | null;
  designation: string | null;
  email: string | null;
};

export function TeamMemberDialog({
  children,
  initial,
  defaultKind = "EMPLOYEE",
}: {
  children: React.ReactNode;
  initial?: TeamMemberInitial;
  defaultKind?: TeamMemberKind;
}) {
  const { formRef, restored, clear, discard } = useFormDraft(
    `team:${initial?.id ?? `new-${defaultKind.toLowerCase()}`}`,
  );
  const [kind, setKind] = React.useState<TeamMemberKind>(initial?.kind ?? defaultKind);
  const { state, formAction, pending, open, setOpen } = useActionDialog(saveTeamMember, {
    onSuccess: clear,
  });
  const editing = Boolean(initial);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit" : "Add"} {kind === "INTERN" ? "intern" : "team member"}
          </DialogTitle>
          <DialogDescription>
            Someone at Foxwel who can coordinate a project. This doesn&rsquo;t give them a login.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} ref={formRef} className="contents">
          {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
          <input type="hidden" name="kind" value={kind} />

          <DialogBody className="space-y-4">
            <DraftNotice restored={restored} onDiscard={discard} />
            <FormAlert state={state} />

            <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
              {TEAM_MEMBER_KINDS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setKind(option)}
                  aria-pressed={kind === option}
                  className={cn(
                    "rounded px-2.5 py-1 text-[12px] font-medium transition-colors",
                    kind === option
                      ? "bg-surface-3 text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {TEAM_MEMBER_KIND_LABELS[option]}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="name" label="Name" required errors={state.fieldErrors}>
                {(props) => (
                  <Input
                    {...props}
                    defaultValue={initial?.name ?? ""}
                    placeholder="Anoop Prabhu"
                    autoComplete="off"
                    required
                    autoFocus
                  />
                )}
              </Field>
              <Field name="phone" label="Phone" required errors={state.fieldErrors}>
                {(props) => (
                  <Input
                    {...props}
                    type="tel"
                    inputMode="tel"
                    defaultValue={initial?.phone ?? ""}
                    placeholder="+91 98450 00000"
                    required
                  />
                )}
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="designation" label="Role" errors={state.fieldErrors}>
                {(props) => (
                  <Input
                    {...props}
                    defaultValue={initial?.designation ?? ""}
                    placeholder={kind === "INTERN" ? "Design intern" : "Project manager"}
                  />
                )}
              </Field>
              <Field name="email" label="Email" errors={state.fieldErrors}>
                {(props) => (
                  <Input
                    {...props}
                    type="email"
                    defaultValue={initial?.email ?? ""}
                    placeholder="anoop@foxwel.ai"
                  />
                )}
              </Field>
            </div>
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pending={pending}>{editing ? "Save changes" : "Add to team"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
