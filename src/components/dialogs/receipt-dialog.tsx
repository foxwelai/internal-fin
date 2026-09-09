"use client";

import * as React from "react";
import { Info, Wand2 } from "lucide-react";

import { saveReceipt } from "@/app/actions/receipts";
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
import { Badge } from "@/components/ui/badge";
import {
  Field,
  FormAlert,
  FormReadout,
  MoneyInput,
  SubmitButton,
} from "@/components/finance/form-kit";
import { useActionDialog } from "@/components/finance/use-action-dialog";
import { Money } from "@/components/finance/money";
import type { ProjectOption } from "@/components/finance/options";
import { PAYMENT_METHOD_LABELS } from "@/lib/finance/labels";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/finance/types";
import { formatForCsv, formatINR, tryParseRupeesToPaise } from "@/lib/money";
import { formatDay, parseDateInput } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type ReceiptInitial = {
  id: string;
  projectId: string;
  amountPaise: number;
  receivedOn: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  allocations: { scheduleId: string; amountPaise: number }[];
};

export function ReceiptDialog({
  children,
  projects,
  initial,
  defaultProjectId,
  today,
}: {
  children: React.ReactNode;
  projects: ProjectOption[];
  initial?: ReceiptInitial;
  defaultProjectId?: string;
  /** Today in IST, as "YYYY-MM-DD". */
  today: string;
}) {
  const { state, formAction, pending, open, setOpen } = useActionDialog(saveReceipt);

  const [projectId, setProjectId] = React.useState(
    initial?.projectId ?? defaultProjectId ?? projects[0]?.id ?? "",
  );
  const [amountText, setAmountText] = React.useState(
    initial ? formatForCsv(BigInt(initial.amountPaise)) : "",
  );
  const [mode, setMode] = React.useState<"auto" | "manual">(
    initial && initial.allocations.length > 0 ? "manual" : "auto",
  );
  const [manual, setManual] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      (initial?.allocations ?? []).map((row) => [
        row.scheduleId,
        formatForCsv(BigInt(row.amountPaise)),
      ]),
    ),
  );

  const project = projects.find((row) => row.id === projectId);
  const amountPaise = tryParseRupeesToPaise(amountText) ?? 0n;

  // When editing, this receipt's own amount is not part of "already received".
  const alreadyReceived = project
    ? BigInt(project.receivedPaise) - BigInt(initial?.amountPaise ?? 0)
    : 0n;
  const headroom = project ? BigInt(project.budgetPaise) - alreadyReceived : 0n;
  const overBudget = amountPaise > headroom && amountPaise > 0n;

  const outstandingSchedules = (project?.schedules ?? []).filter((schedule) => {
    const ownAllocation = initial?.allocations.find((row) => row.scheduleId === schedule.id);
    return schedule.outstandingPaise + (ownAllocation?.amountPaise ?? 0) > 0;
  });

  const manualTotal = Object.values(manual).reduce(
    (total, value) => total + (tryParseRupeesToPaise(value) ?? 0n),
    0n,
  );
  const unallocated = amountPaise - (mode === "manual" ? manualTotal : 0n);

  const fillFromSchedule = (scheduleId: string, cap: bigint) => {
    const remainingOnReceipt = amountPaise - manualTotal + (tryParseRupeesToPaise(manual[scheduleId] ?? "") ?? 0n);
    const take = remainingOnReceipt < cap ? remainingOnReceipt : cap;
    setManual((current) => ({
      ...current,
      [scheduleId]: take > 0n ? formatForCsv(take) : "",
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit receipt" : "Record a payment received"}</DialogTitle>
          <DialogDescription>
            Money that actually arrived. Recording it here is what moves this month&rsquo;s collections.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="contents">
          {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
          <input type="hidden" name="projectId" value={projectId} />
          {mode === "auto" ? <input type="hidden" name="autoAllocate" value="on" /> : null}

          <DialogBody className="space-y-4">
            <FormAlert state={state} />

            <div className="space-y-1.5">
              <span className="text-[13px] font-medium leading-none text-muted-foreground">
                Project <span className="text-brand">*</span>
              </span>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger aria-label="Project">
                  <SelectValue placeholder="Choose a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.clientName} — {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {project ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <FormReadout
                  label="Budget"
                  value={<Money value={BigInt(project.budgetPaise)} className="text-[13px]" />}
                />
                <FormReadout
                  label="Received"
                  value={<Money value={alreadyReceived} className="text-[13px]" />}
                />
                <FormReadout
                  label="Can still receive"
                  tone={overBudget ? "warning" : "default"}
                  value={
                    <Money
                      value={headroom}
                      tone={overBudget ? "negative" : "default"}
                      className="text-[13px]"
                    />
                  }
                />
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="amount" label="Amount received" required errors={state.fieldErrors}>
                {(props) => (
                  <MoneyInput
                    {...props}
                    value={amountText}
                    onChange={(event) => setAmountText(event.target.value)}
                    placeholder="1,00,000"
                    required
                  />
                )}
              </Field>
              <Field name="receivedOn" label="Actual receipt date" required errors={state.fieldErrors}>
                {(props) => (
                  <Input
                    {...props}
                    type="date"
                    defaultValue={initial?.receivedOn ?? today}
                    max="2100-12-31"
                    required
                  />
                )}
              </Field>
            </div>

            {overBudget ? (
              <p className="rounded-md border border-negative/35 bg-negative-soft px-3 py-2 text-[12px] leading-relaxed text-negative">
                This is {formatINR(amountPaise - headroom)} more than the project budget allows.
                Increase the budget first if the scope grew.
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className="text-[13px] font-medium leading-none text-muted-foreground">
                  Payment method
                </span>
                <select
                  name="method"
                  defaultValue={initial?.method ?? "BANK_TRANSFER"}
                  className="flex h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground hover:border-border-strong focus-visible:border-brand-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {PAYMENT_METHOD_LABELS[method]}
                    </option>
                  ))}
                </select>
              </div>
              <Field name="reference" label="Reference number" errors={state.fieldErrors}>
                {(props) => (
                  <Input {...props} defaultValue={initial?.reference ?? ""} placeholder="NEFT / UTR" />
                )}
              </Field>
            </div>

            {/* -------------------------- Allocation -------------------------- */}

            <div className="rounded-lg border border-border bg-surface-2/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-medium">Apply to scheduled payments</span>
                {outstandingSchedules.length > 0 ? (
                  <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
                    <button
                      type="button"
                      onClick={() => setMode("auto")}
                      className={cn(
                        "rounded px-2 py-1 text-[12px] font-medium transition-colors",
                        mode === "auto"
                          ? "bg-surface-3 text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Wand2 className="mr-1 inline size-3" />
                      Oldest first
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("manual")}
                      className={cn(
                        "rounded px-2 py-1 text-[12px] font-medium transition-colors",
                        mode === "manual"
                          ? "bg-surface-3 text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Choose
                    </button>
                  </div>
                ) : null}
              </div>

              {outstandingSchedules.length === 0 ? (
                <p className="mt-2 flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
                  <Info className="mt-px size-3.5 shrink-0 text-faint-foreground" />
                  This project has no unpaid scheduled payments. The receipt will be recorded as
                  unallocated — it still reduces the remaining contract balance, and can be matched
                  later once a schedule exists.
                </p>
              ) : mode === "auto" ? (
                <p className="mt-2 flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
                  <Info className="mt-px size-3.5 shrink-0 text-faint-foreground" />
                  The amount will fill the earliest unpaid milestones first. Anything left over stays
                  unallocated and visible on the Payments page.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {outstandingSchedules.map((schedule) => {
                    const own = initial?.allocations.find((row) => row.scheduleId === schedule.id);
                    const capacity = BigInt(schedule.outstandingPaise + (own?.amountPaise ?? 0));
                    return (
                      <li
                        key={schedule.id}
                        className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">{schedule.label}</p>
                          <p className="text-[11px] text-faint-foreground">
                            {formatDay(parseDateInput(schedule.dueDate) ?? undefined)} · unpaid{" "}
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
                            value={manual[schedule.id] ?? ""}
                            onChange={(event) =>
                              setManual((current) => ({
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
                            onClick={() => fillFromSchedule(schedule.id, capacity)}
                          >
                            Fill
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {mode === "manual" && amountPaise > 0n ? (
                <div className="mt-3 flex items-baseline justify-between border-t border-border pt-2 text-[12px]">
                  <span className="text-muted-foreground">Unallocated after this</span>
                  <Money
                    value={unallocated}
                    tone={unallocated < 0n ? "negative" : unallocated > 0n ? "muted" : "positive"}
                    className="text-[13px]"
                  />
                </div>
              ) : null}
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
            <SubmitButton pending={pending} disabled={pending || !projectId}>
              {initial ? "Save receipt" : "Record payment"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
