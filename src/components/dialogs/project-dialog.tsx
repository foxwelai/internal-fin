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
import { useFormDraft } from "@/components/finance/use-form-draft";
import { DraftNotice } from "@/components/finance/draft-notice";
import type { ClientOption } from "@/components/finance/options";
import { useTeamOptions } from "@/components/finance/team-options";
import { ProgressFields } from "@/components/finance/progress-fields";
import {
  BILLING_TYPE_LABELS,
  COMMISSION_BASIS_LABELS,
  PROJECT_STATUS_LABELS,
  RECURRING_INTERVAL_LABELS,
} from "@/lib/finance/labels";
import {
  BILLING_TYPES,
  COMMISSION_BASES,
  PROJECT_STATUSES,
  RECURRING_INTERVALS,
  type BillingType,
  type CommissionBasis,
  type ProjectProgress,
  type ProjectStatus,
  type RecurringInterval,
} from "@/lib/finance/types";
import { formatForCsv } from "@/lib/money";
import { cn } from "@/lib/utils";

export type ProjectInitial = {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  budgetPaise: number;
  status: ProjectStatus;
  startDate: string | null;
  expectedCompletionDate: string | null;
  projectUrl: string | null;
  notes: string | null;
  billingType: BillingType;
  recurringInterval: RecurringInterval | null;
  recurringAmountPaise: number | null;
  commissionBasis: CommissionBasis | null;
  commissionPayee: string | null;
  commissionRateBps: number | null;
  commissionAmountPaise: number | null;
  commissionNotes: string | null;
  coordinatorId: string | null;
  progress: ProjectProgress;
  progressPercent: number;
  progressNotes: string | null;
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
  const { formRef, restored, clear, discard } = useFormDraft(`project:${initial?.id ?? "new"}`);
  const { state, formAction, pending, open, setOpen } = useActionDialog(saveProject, {
    onSuccess: clear,
  });
  const [status, setStatus] = React.useState<ProjectStatus>(initial?.status ?? "PENDING");
  const [billingType, setBillingType] = React.useState<BillingType>(
    initial?.billingType ?? "ONE_TIME",
  );
  const [commissionBasis, setCommissionBasis] = React.useState<CommissionBasis | "">(
    initial?.commissionBasis ?? "",
  );
  const editing = Boolean(initial);
  const team = useTeamOptions();
  // People who have left stay selectable only on the projects they already run.
  const coordinators = team.filter((member) => member.active || member.id === initial?.coordinatorId);

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

        <form action={formAction} ref={formRef} className="contents">
          {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="billingType" value={billingType} />
          <input type="hidden" name="commissionBasis" value={commissionBasis} />

          <DialogBody className="space-y-4">
            <DraftNotice restored={restored} onDiscard={discard} />
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

            <Field
              name="projectUrl"
              label="Project link"
              errors={state.fieldErrors}
              hint="Optional — a staging site, repo or brief."
            >
              {(props) => (
                <Input
                  {...props}
                  inputMode="url"
                  defaultValue={initial?.projectUrl ?? ""}
                  placeholder="staging.northwind.example"
                />
              )}
            </Field>

            {/* --------------------------- Delivery --------------------------- */}

            <fieldset className="space-y-3 rounded-lg border border-border bg-surface-2/60 p-3">
              <legend className="px-1 text-[12px] font-medium text-muted-foreground">
                Foxwel coordinator & progress
              </legend>

              <Field
                name="coordinatorId"
                label="Coordinator / point of contact"
                errors={state.fieldErrors}
                hint={
                  coordinators.length === 0 ? (
                    <>
                      No one on the team list yet —{" "}
                      <a href="/settings#foxwel-team" className="text-brand hover:underline">
                        add people in Settings
                      </a>
                      .
                    </>
                  ) : (
                    "Picked from the Foxwel team in Settings."
                  )
                }
              >
                {(props) => (
                  <select
                    {...props}
                    defaultValue={initial?.coordinatorId ?? ""}
                    className="flex h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground hover:border-border-strong focus-visible:border-brand-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
                  >
                    <option value="">Not assigned</option>
                    {(["EMPLOYEE", "INTERN"] as const).map((kind) => {
                      const group = coordinators.filter((member) => member.kind === kind);
                      if (group.length === 0) return null;
                      return (
                        <optgroup key={kind} label={kind === "INTERN" ? "Interns" : "Team"}>
                          {group.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.name}
                              {member.designation ? ` — ${member.designation}` : ""}
                              {member.phone ? ` · ${member.phone}` : ""}
                              {member.active ? "" : " (left)"}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                )}
              </Field>

              <ProgressFields
                errors={state.fieldErrors}
                initialProgress={initial?.progress ?? "NOT_STARTED"}
                initialPercent={initial?.progressPercent ?? 0}
                initialNotes={initial?.progressNotes ?? ""}
              />
            </fieldset>

            {/* ------------------------- Billing shape ------------------------ */}

            <fieldset className="space-y-3 rounded-lg border border-border bg-surface-2/60 p-3">
              <legend className="px-1 text-[12px] font-medium text-muted-foreground">
                How it is billed
              </legend>

              <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
                {BILLING_TYPES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setBillingType(option)}
                    aria-pressed={billingType === option}
                    className={cn(
                      "rounded px-2.5 py-1 text-[12px] font-medium transition-colors",
                      billingType === option
                        ? "bg-surface-3 text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {BILLING_TYPE_LABELS[option]}
                  </button>
                ))}
              </div>

              {billingType === "SUBSCRIPTION" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    name="recurringAmount"
                    label="Recurring amount"
                    required
                    errors={state.fieldErrors}
                  >
                    {(props) => (
                      <MoneyInput
                        {...props}
                        defaultValue={
                          initial?.recurringAmountPaise
                            ? formatForCsv(BigInt(initial.recurringAmountPaise))
                            : ""
                        }
                        placeholder="25,000"
                      />
                    )}
                  </Field>
                  <div className="space-y-1.5">
                    <span className="text-[13px] font-medium leading-none text-muted-foreground">
                      Renews <span className="text-brand">*</span>
                    </span>
                    <select
                      name="recurringInterval"
                      defaultValue={initial?.recurringInterval ?? "MONTHLY"}
                      className="flex h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground hover:border-border-strong focus-visible:border-brand-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
                    >
                      {RECURRING_INTERVALS.map((interval) => (
                        <option key={interval} value={interval}>
                          {RECURRING_INTERVAL_LABELS[interval]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[12px] leading-relaxed text-faint-foreground sm:col-span-2">
                    The budget above stays the total contract value. This is the price per period,
                    used to compare retainers like for like.
                  </p>
                </div>
              ) : (
                <input type="hidden" name="recurringInterval" value="" />
              )}
            </fieldset>

            {/* ------------------------- Commission --------------------------- */}

            <fieldset className="space-y-3 rounded-lg border border-border bg-surface-2/60 p-3">
              <legend className="px-1 text-[12px] font-medium text-muted-foreground">
                Referral commission
              </legend>

              <div className="inline-flex flex-wrap gap-0.5 rounded-md border border-border bg-surface p-0.5">
                {([["", "None"], ...COMMISSION_BASES.map((b) => [b, COMMISSION_BASIS_LABELS[b]] as const)] as const).map(
                  ([option, label]) => (
                    <button
                      key={option || "none"}
                      type="button"
                      onClick={() => setCommissionBasis(option as CommissionBasis | "")}
                      aria-pressed={commissionBasis === option}
                      className={cn(
                        "rounded px-2.5 py-1 text-[12px] font-medium transition-colors",
                        commissionBasis === option
                          ? "bg-surface-3 text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ),
                )}
              </div>

              {commissionBasis === "" ? (
                <p className="text-[12px] leading-relaxed text-faint-foreground">
                  Nobody is owed a cut of this project.
                </p>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field name="commissionPayee" label="Paid to" errors={state.fieldErrors}>
                      {(props) => (
                        <Input
                          {...props}
                          defaultValue={initial?.commissionPayee ?? ""}
                          placeholder="Who brought this in"
                        />
                      )}
                    </Field>

                    {commissionBasis === "PERCENT_OF_RECEIVED" ? (
                      <Field
                        name="commissionPercent"
                        label="Rate"
                        required
                        errors={state.fieldErrors}
                        hint="A share of money collected, so nothing is owed on an unpaid invoice."
                      >
                        {(props) => (
                          <div className="relative">
                            <Input
                              {...props}
                              inputMode="decimal"
                              defaultValue={
                                initial?.commissionRateBps ? String(initial.commissionRateBps / 100) : ""
                              }
                              placeholder="10"
                              className="pr-7 font-mono tabular"
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[13px] text-faint-foreground">
                              %
                            </span>
                          </div>
                        )}
                      </Field>
                    ) : (
                      <Field
                        name="commissionAmount"
                        label="Amount"
                        required
                        errors={state.fieldErrors}
                        hint="A flat fee, however much is collected."
                      >
                        {(props) => (
                          <MoneyInput
                            {...props}
                            defaultValue={
                              initial?.commissionAmountPaise
                                ? formatForCsv(BigInt(initial.commissionAmountPaise))
                                : ""
                            }
                            placeholder="15,000"
                          />
                        )}
                      </Field>
                    )}
                  </div>

                  <Field name="commissionNotes" label="Commission notes" errors={state.fieldErrors}>
                    {(props) => (
                      <Textarea {...props} defaultValue={initial?.commissionNotes ?? ""} rows={2} />
                    )}
                  </Field>
                </>
              )}
            </fieldset>

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
