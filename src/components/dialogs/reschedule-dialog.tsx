"use client";

import * as React from "react";

import { rescheduleMany, rescheduleSchedule } from "@/app/actions/schedules";
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
import { Money } from "@/components/finance/money";

/**
 * Moving an overdue expectation to a new date is the *only* way it re-enters a
 * month's forecast. Nothing rolls a due date forward automatically.
 */
export function RescheduleDialog({
  children,
  scheduleId,
  label,
  defaultDate,
}: {
  children: React.ReactNode;
  scheduleId: string;
  label: string;
  defaultDate: string;
}) {
  const { state, formAction, pending, open, setOpen } = useActionDialog(rescheduleSchedule);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule &ldquo;{label}&rdquo;</DialogTitle>
          <DialogDescription>
            Give this payment a new expected date. It will then count towards the forecast for
            whichever month that date falls in.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="contents">
          <input type="hidden" name="id" value={scheduleId} />
          <DialogBody className="space-y-4">
            <FormAlert state={state} />
            <Field name="dueDate" label="New expected date" required errors={state.fieldErrors}>
              {(props) => <Input {...props} type="date" defaultValue={defaultDate} required autoFocus />}
            </Field>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pending={pending}>Reschedule</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type OverdueScheduleRow = {
  id: string;
  label: string;
  projectName: string;
  clientName: string;
  dueDate: string;
  outstandingPaise: number;
};

/** Bulk move for the carried-forward overdue block on the Payments page. */
export function RescheduleManyDialog({
  children,
  rows,
  defaultDate,
}: {
  children: React.ReactNode;
  rows: OverdueScheduleRow[];
  defaultDate: string;
}) {
  const { state, formAction, pending, open, setOpen } = useActionDialog(rescheduleMany);
  const [selected, setSelected] = React.useState<string[]>(() => rows.map((row) => row.id));

  const total = selected.reduce((sum, id) => {
    const row = rows.find((candidate) => candidate.id === id);
    return sum + BigInt(row?.outstandingPaise ?? 0);
  }, 0n);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reschedule overdue payments</DialogTitle>
          <DialogDescription>
            These fell due in an earlier month, so they are held out of every forecast. Give them a
            realistic new date and they will be counted again.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="contents">
          <DialogBody className="space-y-4">
            <FormAlert state={state} />

            <ul className="space-y-1.5">
              {rows.map((row) => {
                const checked = selected.includes(row.id);
                return (
                  <li key={row.id}>
                    <label className="flex items-center gap-2.5 rounded-md border border-border bg-surface-2 px-2.5 py-2">
                      <input
                        type="checkbox"
                        name="scheduleId"
                        value={row.id}
                        checked={checked}
                        onChange={(event) =>
                          setSelected((current) =>
                            event.target.checked
                              ? [...current, row.id]
                              : current.filter((id) => id !== row.id),
                          )
                        }
                        className="size-4 accent-[var(--brand)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{row.label}</span>
                        <span className="block truncate text-[12px] text-muted-foreground">
                          {row.clientName} · {row.projectName} · due {row.dueDate}
                        </span>
                      </span>
                      <Money value={BigInt(row.outstandingPaise)} className="text-[13px]" />
                    </label>
                  </li>
                );
              })}
            </ul>

            <Field name="dueDate" label="New expected date" required errors={state.fieldErrors}>
              {(props) => <Input {...props} type="date" defaultValue={defaultDate} required />}
            </Field>

            <div className="flex items-baseline justify-between rounded-md border border-border bg-surface-2 px-3 py-2 text-[13px]">
              <span className="text-muted-foreground">
                {selected.length} payment{selected.length === 1 ? "" : "s"} selected
              </span>
              <Money value={total} />
            </div>
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pending={pending} disabled={pending || selected.length === 0}>
              Reschedule {selected.length}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
