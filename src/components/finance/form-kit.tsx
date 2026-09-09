"use client";

import * as React from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/app/actions/state";

/**
 * One labelled control, with its inline error and hint wired to the right
 * aria attributes. Errors come from the server action, so the browser and the
 * database agree on what is valid.
 */
export function Field({
  name,
  label,
  hint,
  errors,
  required,
  className,
  children,
}: {
  name: string;
  label: string;
  hint?: React.ReactNode;
  errors?: Record<string, string[]>;
  required?: boolean;
  className?: string;
  children: (props: {
    id: string;
    name: string;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
  }) => React.ReactNode;
}) {
  const error = errors?.[name]?.[0];
  const describedBy = [error ? `${name}-error` : null, hint ? `${name}-hint` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name}>
        {label}
        {required ? <span className="ml-0.5 text-brand">*</span> : null}
      </Label>
      {children({
        id: name,
        name,
        "aria-invalid": Boolean(error),
        "aria-describedby": describedBy || undefined,
      })}
      {hint && !error ? (
        <p id={`${name}-hint`} className="text-[12px] leading-relaxed text-faint-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${name}-error`} className="text-[12px] text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Amounts are typed as rupees and parsed to integer paise on the server.
 * inputMode="decimal" gets the numeric keypad on a phone without losing the
 * ability to paste "1,25,000".
 */
export function MoneyInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[13px] text-faint-foreground">
        ₹
      </span>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={cn("pl-7 font-mono tabular", className)}
      />
    </div>
  );
}

export function FormAlert({ state }: { state: ActionState }) {
  if (state.status !== "error" || !state.message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-negative/35 bg-negative-soft px-3 py-2 text-[13px] leading-relaxed text-negative"
    >
      <AlertCircle className="mt-px size-4 shrink-0" />
      <span>{state.message}</span>
    </div>
  );
}

export function SubmitButton({
  children,
  pending,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { pending?: boolean }) {
  return (
    <Button type="submit" disabled={pending} className={className} {...props}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      {children}
    </Button>
  );
}

/** A read-only figure shown inside a form, e.g. remaining project balance. */
export function FormReadout({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 rounded-md border px-3 py-2",
        tone === "warning" ? "border-warning/30 bg-warning-soft" : "border-border bg-surface-2",
      )}
    >
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="text-[13px]">{value}</span>
    </div>
  );
}
