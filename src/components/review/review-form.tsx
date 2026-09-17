"use client";

import * as React from "react";
import { CheckCircle2, Star } from "lucide-react";

import { submitClientReview } from "@/app/actions/public-review";
import { IDLE } from "@/app/actions/state";
import { Field, FormAlert, SubmitButton } from "@/components/finance/form-kit";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

export function ReviewForm({ token, defaultName }: { token: string; defaultName: string }) {
  const [state, formAction, pending] = React.useActionState(submitClientReview, IDLE);
  const [rating, setRating] = React.useState(0);
  const [hover, setHover] = React.useState(0);

  if (state.status === "success") {
    return (
      <div className="py-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-positive" />
        <h2 className="mt-3 text-lg font-semibold">Thank you!</h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
          Your review has reached the Foxwel team. You can close this page.
        </p>
      </div>
    );
  }

  const shown = hover || rating;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="rating" value={rating || ""} />
      <FormAlert state={state} />

      <fieldset className="space-y-2 text-center">
        <legend className="mx-auto text-[13px] font-medium text-muted-foreground">
          Overall, how was it? <span className="text-brand">*</span>
        </legend>
        <div className="flex justify-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              onMouseEnter={() => setHover(value)}
              aria-label={`${value} star${value === 1 ? "" : "s"} — ${RATING_WORDS[value]}`}
              aria-pressed={rating === value}
              className="rounded-md p-1.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <Star
                className={cn(
                  "size-9 sm:size-10",
                  value <= shown ? "fill-brand text-brand" : "text-border-strong",
                )}
              />
            </button>
          ))}
        </div>
        <p className="h-5 text-[13px] text-muted-foreground">{RATING_WORDS[shown]}</p>
        {state.fieldErrors?.rating ? (
          <p className="text-[12px] text-negative">{state.fieldErrors.rating[0]}</p>
        ) : null}
      </fieldset>

      <Field name="whatWentWell" label="What went well?" errors={state.fieldErrors}>
        {(props) => (
          <Textarea {...props} rows={3} placeholder="The team, the result, the process…" />
        )}
      </Field>

      <Field name="couldImprove" label="What could we do better?" errors={state.fieldErrors}>
        {(props) => <Textarea {...props} rows={3} placeholder="Anything at all — we read every word." />}
      </Field>

      <Field name="reviewerName" label="Your name" required errors={state.fieldErrors}>
        {(props) => <Input {...props} defaultValue={defaultName} autoComplete="name" required />}
      </Field>

      <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-muted-foreground">
        <input
          type="checkbox"
          name="canQuote"
          className="mt-0.5 size-4 shrink-0 rounded border-border accent-[var(--brand)]"
        />
        Foxwel may quote this review, with my name, on their website.
      </label>

      <SubmitButton pending={pending} disabled={pending || rating === 0} className="w-full">
        Send review
      </SubmitButton>
    </form>
  );
}
