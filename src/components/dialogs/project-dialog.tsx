"use client";

import * as React from "react";

import { saveProject } from "@/app/actions/projects";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormAlert, MoneyInput, SubmitButton } from "@/components/finance/form-kit";
import { useActionDialog } from "@/components/finance/use-action-dialog";
import type { ClientOption } from "@/components/finance/options";
import { PROJECT_STATUS_LABELS } from "@/lib/finance/labels";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/finance/types";
import { formatForCsv } from "@/lib/money";

export type ProjectInitial = {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  budgetPaise: number;
  status: ProjectStatus;
  startDate: string | null;
  expectedCompletionDate: string | null;
  notes: string | null;
};

const STATUS_HINT: Record<ProjectStatus, string> = {
  APPROVED: "Counted in monthly collection forecasts.",
  PENDING: "Held in the potential pipeline — never forecast.",
  ON_HOLD: "Held in the potential pipeline. Money already received stays on the books.",
};

export function ProjectDialog({
  children,
  clients,
  initial,
  defaultClientId,
}: {
  children: React.ReactNode;
  clients: ClientOption[];
  initial?: ProjectInitial;
  defaultClientId?: string;
}) {
  const { state, formAction, pending, open, setOpen } = useActionDialog(saveProject);
  const [status, setStatus] = React.useState<ProjectStatus>(initial?.status ?? "PENDING");
  const editing = Boolean(initial);

  const selectable = clients.filter((client) => !client.archived || client.id === initial?.clientId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            The budget is the total agreed value. Advances and milestones are portions of it, not
            extra revenue.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="contents">
          {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
          <input type="hidden" name="status" value={status} />

          <DialogBody className="space-y-4">
            <FormAlert state={state} />

            {selectable.length === 0 ? (
              <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-[13px] text-warning">
                Add a client first — every project belongs to one.
              </p>
            ) : null}

            <Field name="clientId" label="Client" required errors={state.fieldErrors}>
              {(props) => (
                <select
                  {...props}
                  defaultValue={initial?.clientId ?? defaultClientId ?? ""}
                  required
                  className="flex h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground hover:border-border-strong focus-visible:border-brand-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
                >
                  <option value="" disabled>
                    Choose a client
                  </option>
                  {selectable.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field name="name" label="Project name" required errors={state.fieldErrors}>
              {(props) => (
                <Input
                  {...props}
                  defaultValue={initial?.name ?? ""}
                  placeholder="Commerce replatform"
                  required
                />
              )}
            </Field>

            <Field
              name="description"
              label="Description or service type"
              errors={state.fieldErrors}
            >
              {(props) => (
                <Input
                  {...props}
                  defaultValue={initial?.description ?? ""}
                  placeholder="Headless storefront and checkout rebuild"
                />
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="budget"
                label="Total agreed budget"
                required
                errors={state.fieldErrors}
                hint="Indian grouping is fine — 8,50,000"
              >
                {(props) => (
                  <MoneyInput
                    {...props}
                    defaultValue={initial ? formatForCsv(BigInt(initial.budgetPaise)) : ""}
                    placeholder="8,50,000"
                    required
                  />
                )}
              </Field>

              <div className="space-y-1.5">
                <span className="text-[13px] font-medium leading-none text-muted-foreground">
                  Status
                </span>
                <Select value={status} onValueChange={(value) => setStatus(value as ProjectStatus)}>
                  <SelectTrigger aria-label="Project status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUSES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {PROJECT_STATUS_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[12px] leading-relaxed text-faint-foreground">
                  {STATUS_HINT[status]}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="startDate" label="Start date" errors={state.fieldErrors}>
                {(props) => <Input {...props} type="date" defaultValue={initial?.startDate ?? ""} />}
              </Field>
              <Field
                name="expectedCompletionDate"
                label="Expected completion"
                errors={state.fieldErrors}
              >
                {(props) => (
                  <Input
                    {...props}
                    type="date"
                    defaultValue={initial?.expectedCompletionDate ?? ""}
                  />
                )}
              </Field>
            </div>

            <Field name="notes" label="Notes" errors={state.fieldErrors}>
              {(props) => <Textarea {...props} defaultValue={initial?.notes ?? ""} rows={3} />}
            </Field>
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pending={pending} disabled={pending || selectable.length === 0}>
              {editing ? "Save changes" : "Create project"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
