"use client";

import * as React from "react";

import { Field } from "@/components/finance/form-kit";
import { Textarea } from "@/components/ui/textarea";
import { PROJECT_PROGRESS_LABELS } from "@/lib/finance/labels";
import { PROJECT_PROGRESSES, type ProjectProgress } from "@/lib/finance/types";
import { cn } from "@/lib/utils";

/**
 * Stage, percentage and a note on what's done. Stage and percentage nudge each
 * other so they can't contradict: completed is 100%, and moving the slider off
 * zero means the work has started.
 */
export function ProgressFields({
  errors,
  initialProgress,
  initialPercent,
  initialNotes,
}: {
  errors?: Record<string, string[]>;
  initialProgress: ProjectProgress;
  initialPercent: number;
  initialNotes: string;
}) {
  const [progress, setProgress] = React.useState<ProjectProgress>(initialProgress);
  const [percent, setPercent] = React.useState(initialPercent);

  const chooseStage = (next: ProjectProgress) => {
    setProgress(next);
    if (next === "COMPLETED") setPercent(100);
    else if (next === "NOT_STARTED") setPercent(0);
    else if (percent === 100) setPercent(90);
  };

  const choosePercent = (next: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(Number.isFinite(next) ? next : 0)));
    setPercent(clamped);
    if (clamped === 100) setProgress("COMPLETED");
    else if (clamped === 0 && progress !== "NOT_STARTED") setProgress("NOT_STARTED");
    else if (clamped > 0 && progress === "NOT_STARTED") setProgress("JUST_STARTED");
    else if (clamped < 100 && progress === "COMPLETED") setProgress("IN_PROGRESS");
  };

  const error = errors?.progressPercent?.[0];

  return (
    <div className="space-y-3">
      <input type="hidden" name="progress" value={progress} />

      <div className="space-y-1.5">
        <span className="text-[13px] font-medium leading-none text-muted-foreground">Progress</span>
        <div className="grid grid-cols-2 gap-0.5 rounded-md border border-border bg-surface p-0.5 sm:grid-cols-4">
          {PROJECT_PROGRESSES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => chooseStage(option)}
              aria-pressed={progress === option}
              className={cn(
                "rounded px-2 py-1.5 text-[12px] font-medium transition-colors",
                progress === option
                  ? option === "COMPLETED"
                    ? "bg-positive-soft text-positive"
                    : "bg-surface-3 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {PROJECT_PROGRESS_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="progressPercent" className="flex items-center justify-between text-[13px] font-medium leading-none text-muted-foreground">
          Completion
          <span className="font-mono tabular text-foreground">{percent}%</span>
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={percent}
            onChange={(event) => choosePercent(Number(event.target.value))}
            aria-label="Percent complete"
            className="h-2 w-full cursor-pointer accent-[var(--brand)]"
          />
          <input
            id="progressPercent"
            name="progressPercent"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={percent}
            onChange={(event) => choosePercent(Number(event.target.value))}
            aria-invalid={Boolean(error)}
            className="h-9 w-16 shrink-0 rounded-md border border-border bg-surface-2 px-2 text-right font-mono text-sm tabular text-foreground focus-visible:border-brand-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
          />
        </div>
        {error ? <p className="text-[12px] text-negative">{error}</p> : null}
      </div>

      <Field
        name="progressNotes"
        label="What's completed"
        errors={errors}
        hint="Milestones delivered, what's left — whatever someone picking this up needs to know."
      >
        {(props) => (
          <Textarea
            {...props}
            defaultValue={initialNotes}
            rows={3}
            placeholder="Design signed off, homepage and catalogue built. Checkout in progress."
          />
        )}
      </Field>
    </div>
  );
}
