"use client";

import * as React from "react";

import { saveSchedule } from "@/app/actions/schedules";
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
import {
  Field,
  FormAlert,
  FormReadout,
  MoneyInput,
  SubmitButton,
} from "@/components/finance/form-kit";
import { useActionDialog } from "@/components/finance/use-action-dialog";
import { Money } from "@/components/finance/money";
import { formatForCsv } from "@/lib/money";

export type ScheduleInitial = {
  id: string;
  label: string;
  amountPaise: number;
  dueDate: string;
  notes: string | null;
};

const SUGGESTED_LABELS = [
  "Advance",
  "Design approval",
  "Development milestone",
  "UAT sign-off",
  "Final delivery",
  "Balance on launch",
];

export function ScheduleDialog({
  children,
  projectId,
  projectName,
  /** What is left of the contract that has not been scheduled yet, in paise. */
  availablePaise,
  initial,
  today,
}: {
  children: React.ReactNode;
  projectId: string;
  projectName: string;
  availablePaise: number;
  initial?: ScheduleInitial;
  today: string;
}) {
  const { state, formAction, pending, open, setOpen } = useActionDialog(saveSchedule);
  const headroom = BigInt(availablePaise) + BigInt(initial?.amountPaise ?? 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit scheduled payment" : "Add a scheduled payment"}</DialogTitle>
          <DialogDescription>
            An expectation against {projectName}. It becomes collected money only when a receipt is
            matched to it.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="contents">
          {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
          <input type="hidden" name="projectId" value={projectId} />

          <DialogBody className="space-y-4">
            <FormAlert state={state} />

            <FormReadout
              label="Available to schedule"
              value={<Money value={headroom} className="text-[13px]" />}
            />

            <Field
              name="label"
              label="Label"
              required
              errors={state.fieldErrors}
              hint="What the client is paying for at this point."
            >
              {(props) => (
                <>
                  <Input
                    {...props}
                    defaultValue={initial?.label ?? ""}
                    placeholder="Design approval"
                    list="schedule-label-suggestions"
                    required
                    autoFocus
                  />
                  <datalist id="schedule-label-suggestions">
                    {SUGGESTED_LABELS.map((label) => (
                      <option key={label} value={label} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="amount" label="Expected amount" required errors={state.fieldErrors}>
                {(props) => (
                  <MoneyInput
                    {...props}
                    defaultValue={initial ? formatForCsv(BigInt(initial.amountPaise)) : ""}
                    placeholder="1,20,000"
                    required
                  />
                )}
              </Field>
              <Field
                name="dueDate"
                label="Expected payment date"
                required
                errors={state.fieldErrors}
              >
                {(props) => (
                  <Input {...props} type="date" defaultValue={initial?.dueDate ?? today} required />
                )}
              </Field>
            </div>

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
            <SubmitButton pending={pending}>
              {initial ? "Save changes" : "Add to schedule"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
