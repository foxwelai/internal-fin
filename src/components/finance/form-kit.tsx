"use client";

import * as React from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { countDigitsBefore, formatMoneyInput, offsetAfterDigits } from "@/lib/money";
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
 *
 * Digits are regrouped Indian-style as they are typed — 125000 reads back as
 * 1,25,000 — because an unseparated seven-digit number is genuinely hard to
 * check. The caret is anchored to the digit it was after rather than to a
 * character offset, so inserting a separator does not shunt it sideways.
 *
 * Works controlled or uncontrolled: pass `value` + `onChange` and you receive
 * the formatted text, or pass `defaultValue` and leave it alone.
 */
export function MoneyInput({
  className,
  value,
  defaultValue,
  onChange,
  ref,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
  const innerRef = React.useRef<HTMLInputElement>(null);
  const [uncontrolled, setUncontrolled] = React.useState(() =>
    formatMoneyInput(String(defaultValue ?? "")),
  );
  const isControlled = value !== undefined;
  const shown = isControlled ? String(value ?? "") : uncontrolled;

  // Where the caret should land once React has painted the regrouped text.
  const pendingCaret = React.useRef<number | null>(null);

  React.useLayoutEffect(() => {
    const input = innerRef.current;
    if (!input || pendingCaret.current === null) return;
    const caret = offsetAfterDigits(input.value, pendingCaret.current);
    pendingCaret.current = null;
    input.setSelectionRange(caret, caret);
  }, [shown]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    const caret = event.target.selectionStart ?? raw.length;
    pendingCaret.current = countDigitsBefore(raw, caret);

    const formatted = formatMoneyInput(raw);
    if (!isControlled) setUncontrolled(formatted);

    // Hand the parent the formatted text; every parser here strips separators.
    event.target.value = formatted;
    onChange?.(event);
  };

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[13px] text-faint-foreground">
        ₹
      </span>
      <Input
        {...props}
        ref={(node) => {
          innerRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={shown}
        onChange={handleChange}
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
