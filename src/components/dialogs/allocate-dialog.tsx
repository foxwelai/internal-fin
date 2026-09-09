"use client";

import * as React from "react";

import { allocateReceipt } from "@/app/actions/receipts";
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
import { Badge } from "@/components/ui/badge";
import { FormAlert, MoneyInput, SubmitButton } from "@/components/finance/form-kit";
import { useActionDialog } from "@/components/finance/use-action-dialog";
import { Money } from "@/components/finance/money";
import { EmptyState } from "@/components/finance/empty-state";
import { formatForCsv, tryParseRupeesToPaise } from "@/lib/money";
import type { ScheduleOption } from "@/components/finance/options";

/** Match an already-recorded receipt to the schedule lines it settles. */
export function AllocateDialog({
  children,
  receiptId,
  receiptAmountPaise,
  schedules,
  existing,
}: {
  children: React.ReactNode;
  receiptId: string;
  receiptAmountPaise: number;
  schedules: ScheduleOption[];
  existing: { scheduleId: string; amountPaise: number }[];
}) {
  const { state, formAction, pending, open, setOpen } = useActionDialog(allocateReceipt);
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      existing.map((row) => [row.scheduleId, formatForCsv(BigInt(row.amountPaise))]),
    ),
  );

  const allocated = Object.values(values).reduce(
    (total, value) => total + (tryParseRupeesToPaise(value) ?? 0n),
    0n,
  );
  const unallocated = BigInt(receiptAmountPaise) - allocated;

  const candidates = schedules.filter((schedule) => {
    const own = existing.find((row) => row.scheduleId === schedule.id);
    return schedule.outstandingPaise + (own?.amountPaise ?? 0) > 0;
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Match receipt to scheduled payments</DialogTitle>
          <DialogDescription>
            Allocating does not change the money received — it records which milestones this payment
            settles, so the schedule stops asking for it twice.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="contents">
          <input type="hidden" name="receiptId" value={receiptId} />

          <DialogBody className="space-y-4">
            <FormAlert state={state} />

            {candidates.length === 0 ? (
              <EmptyState
                title="Nothing to match against"
                description="This project has no unpaid scheduled payments. Add one first, then come back."
                compact
              />
            ) : (
              <ul className="space-y-2">
                {candidates.map((schedule) => {
                  const own = existing.find((row) => row.scheduleId === schedule.id);
                  const capacity = BigInt(schedule.outstandingPaise + (own?.amountPaise ?? 0));
                  return (
                    <li
                      key={schedule.id}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{schedule.label}</p>
                        <p className="text-[11px] text-faint-foreground">
                          due {schedule.dueDate} · unpaid{" "}
                          <Money value={capacity} className="text-[11px]" />
                          {schedule.overdue ? (
                            <Badge variant="negative" className="ml-1.5 align-middle">
                              Overdue
                            </Badge>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MoneyInput
                          name={`alloc:${schedule.id}`}
                          value={values[schedule.id] ?? ""}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              [schedule.id]: event.target.value,
                            }))
                          }
                          placeholder="0"
                          className="h-8 w-32 text-[13px]"
                          aria-label={`Amount to apply to ${schedule.label}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-[12px]"
                          onClick={() => {
                            const spare =
                              unallocated + (tryParseRupeesToPaise(values[schedule.id] ?? "") ?? 0n);
                            const take = spare < capacity ? spare : capacity;
                            setValues((current) => ({
                              ...current,
                              [schedule.id]: take > 0n ? formatForCsv(take) : "",
                            }));
                          }}
                        >
                          Fill
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex items-baseline justify-between rounded-md border border-border bg-surface-2 px-3 py-2 text-[13px]">
              <span className="text-muted-foreground">Unallocated after this</span>
              <Money
                value={unallocated}
                tone={unallocated < 0n ? "negative" : unallocated > 0n ? "muted" : "positive"}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pending={pending} disabled={pending || candidates.length === 0}>
              Save allocation
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
