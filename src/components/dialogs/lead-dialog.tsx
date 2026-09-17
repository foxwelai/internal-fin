"use client";

import * as React from "react";

import { saveLead } from "@/app/actions/leads";
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
import { Field, FormAlert, MoneyInput, SubmitButton } from "@/components/finance/form-kit";
import { useActionDialog } from "@/components/finance/use-action-dialog";
import { useFormDraft } from "@/components/finance/use-form-draft";
import { DraftNotice } from "@/components/finance/draft-notice";
import { useTeamOptions } from "@/components/finance/team-options";
import {
  LEAD_QUALITIES,
  LEAD_SOURCES,
  WIN_PROBABILITY,
  type LeadQuality,
  type LeadSource,
  type LeadStage,
} from "@/lib/finance/leads";
import { LEAD_QUALITY_LABELS, LEAD_SOURCE_LABELS, LEAD_STAGE_LABELS } from "@/lib/finance/labels";
import { formatForCsv } from "@/lib/money";
import { cn } from "@/lib/utils";

export type LeadInitial = {
  id: string;
  name: string;
  clientName: string;
  phone: string;
  contactPerson: string | null;
  contactPhone: string | null;
  email: string | null;
  website: string | null;
  stage: LeadStage;
  quality: LeadQuality;
  source: LeadSource | null;
  expectedValuePaise: number | null;
  /** "2026-10" */
  expectedCloseMonth: string | null;
  requirement: string | null;
  ownerId: string | null;
  nextFollowUpOn: string | null;
  lostReason: string | null;
  notes: string | null;
};

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground hover:border-border-strong focus-visible:border-brand-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35";

const QUALITY_TONE: Record<LeadQuality, string> = {
  HOT: "bg-negative-soft text-negative",
  WARM: "bg-warning-soft text-warning",
  COLD: "bg-info-soft text-info",
};

export function LeadDialog({ children, initial }: { children: React.ReactNode; initial?: LeadInitial }) {
  const { formRef, restored, clear, discard } = useFormDraft(`lead:${initial?.id ?? "new"}`);
  const { state, formAction, pending, open, setOpen } = useActionDialog(saveLead, { onSuccess: clear });
  const team = useTeamOptions();
  const editing = Boolean(initial);
  const won = initial?.stage === "WON";

  const [stage, setStage] = React.useState<LeadStage>(initial?.stage ?? "JUST_SPOKE");
  const [quality, setQuality] = React.useState<LeadQuality>(initial?.quality ?? "WARM");
  const owners = team.filter((member) => member.active || member.id === initial?.ownerId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit lead" : "New lead"}</DialogTitle>
          <DialogDescription>
            The same details as a client, so winning it needs no retyping.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} ref={formRef} className="contents">
          {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
          {/* A won lead keeps its outcome; the server ignores stage for it. */}
          <input type="hidden" name="stage" value={won ? "IN_PROCESS" : stage} />
          <input type="hidden" name="quality" value={quality} />

          <DialogBody className="space-y-4">
            <DraftNotice restored={restored} onDiscard={discard} />
            <FormAlert state={state} />

            <Field name="name" label="Company name" required errors={state.fieldErrors}>
              {(props) => (
                <Input {...props} defaultValue={initial?.name ?? ""} placeholder="Northwind Retail" required autoFocus />
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="clientName" label="Client name" required errors={state.fieldErrors}>
                {(props) => (
                  <Input {...props} defaultValue={initial?.clientName ?? ""} placeholder="Rahul Shenoy" autoComplete="off" required />
                )}
              </Field>
              <Field name="phone" label="Client phone" required errors={state.fieldErrors}>
                {(props) => (
                  <Input {...props} type="tel" inputMode="tel" defaultValue={initial?.phone ?? ""} placeholder="+91 98200 41122" required />
                )}
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="contactPerson" label="Point of contact" errors={state.fieldErrors} hint="If it's someone else.">
                {(props) => <Input {...props} defaultValue={initial?.contactPerson ?? ""} placeholder="Ananya Rao" autoComplete="off" />}
              </Field>
              <Field name="contactPhone" label="Contact phone" errors={state.fieldErrors}>
                {(props) => (
                  <Input {...props} type="tel" inputMode="tel" defaultValue={initial?.contactPhone ?? ""} placeholder="+91 99000 12345" />
                )}
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="email" label="Email" errors={state.fieldErrors}>
                {(props) => <Input {...props} type="email" defaultValue={initial?.email ?? ""} placeholder="rahul@example.com" />}
              </Field>
              <Field name="website" label="Website" errors={state.fieldErrors}>
                {(props) => <Input {...props} inputMode="url" defaultValue={initial?.website ?? ""} placeholder="northwind.example" />}
              </Field>
            </div>

            {/* ------------------------------ Pipeline ----------------------------- */}

            <fieldset className="space-y-4 rounded-lg border border-border bg-surface-2/60 p-3">
              <legend className="px-1 text-[12px] font-medium text-muted-foreground">Pipeline</legend>

              {won ? (
                <p className="text-[13px] text-positive">{LEAD_STAGE_LABELS.WON} — already a client.</p>
              ) : (
                <div className="space-y-1.5">
                  <span className="text-[13px] font-medium leading-none text-muted-foreground">Stage</span>
                  <div className="grid grid-cols-3 gap-0.5 rounded-md border border-border bg-surface p-0.5">
                    {(["JUST_SPOKE", "IN_PROCESS", "LOST"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setStage(option)}
                        aria-pressed={stage === option}
                        className={cn(
                          "rounded px-2 py-1.5 text-[12px] font-medium transition-colors",
                          stage === option ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {option === "LOST" ? "Lost" : LEAD_STAGE_LABELS[option]}
                      </button>
                    ))}
                  </div>
                  <p className="text-[12px] leading-relaxed text-faint-foreground">
                    Won it? Save, then use <span className="text-foreground">Mark as won</span> from the lead&rsquo;s menu —
                    it becomes a client, ready for a project.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <span className="text-[13px] font-medium leading-none text-muted-foreground">Quality</span>
                <div className="grid grid-cols-3 gap-0.5 rounded-md border border-border bg-surface p-0.5">
                  {LEAD_QUALITIES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setQuality(option)}
                      aria-pressed={quality === option}
                      className={cn(
                        "rounded px-2 py-1.5 text-[12px] font-medium transition-colors",
                        quality === option ? QUALITY_TONE[option] : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {LEAD_QUALITY_LABELS[option]}
                    </button>
                  ))}
                </div>
                {!won && stage !== "LOST" ? (
                  <p className="text-[12px] text-faint-foreground">
                    Counted at <span className="font-mono tabular text-foreground">{WIN_PROBABILITY[stage][quality]}%</span> of
                    its value in the projection.
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="expectedValue" label="Expected value" errors={state.fieldErrors}>
                  {(props) => (
                    <MoneyInput
                      {...props}
                      defaultValue={initial?.expectedValuePaise != null ? formatForCsv(BigInt(initial.expectedValuePaise)) : ""}
                      placeholder="3,00,000"
                    />
                  )}
                </Field>
                <Field name="expectedCloseMonth" label="Expected to close in" errors={state.fieldErrors}>
                  {(props) => (
                    <Input {...props} type="month" defaultValue={initial?.expectedCloseMonth ?? ""} placeholder="2026-10" />
                  )}
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="source" label="Source" errors={state.fieldErrors}>
                  {(props) => (
                    <select {...props} defaultValue={initial?.source ?? ""} className={SELECT_CLASS}>
                      <option value="">Not recorded</option>
                      {LEAD_SOURCES.map((option) => (
                        <option key={option} value={option}>
                          {LEAD_SOURCE_LABELS[option]}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field name="ownerId" label="Handled by" errors={state.fieldErrors}>
                  {(props) => (
                    <select {...props} defaultValue={initial?.ownerId ?? ""} className={SELECT_CLASS}>
                      <option value="">Nobody yet</option>
                      {owners.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                          {member.kind === "INTERN" ? " (intern)" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>

              {!won && stage !== "LOST" ? (
                <Field name="nextFollowUpOn" label="Next follow-up" errors={state.fieldErrors}>
                  {(props) => <Input {...props} type="date" defaultValue={initial?.nextFollowUpOn ?? ""} />}
                </Field>
              ) : null}

              {stage === "LOST" && !won ? (
                <Field name="lostReason" label="Why it was lost" errors={state.fieldErrors}>
                  {(props) => (
                    <Input {...props} defaultValue={initial?.lostReason ?? ""} placeholder="Budget, timing, went with another agency…" />
                  )}
                </Field>
              ) : null}
            </fieldset>

            <Field name="requirement" label="What they need" errors={state.fieldErrors}>
              {(props) => (
                <Textarea {...props} defaultValue={initial?.requirement ?? ""} rows={2} placeholder="E-commerce site with inventory sync." />
              )}
            </Field>

            <Field name="notes" label="Notes" errors={state.fieldErrors}>
              {(props) => <Textarea {...props} defaultValue={initial?.notes ?? ""} rows={2} placeholder="Conversation so far, decision makers, timing." />}
            </Field>
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pending={pending}>{editing ? "Save changes" : "Add lead"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
