"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useActionForm } from "@/components/finance/use-action-dialog";
import { toast } from "sonner";

import type { ActionState } from "@/app/actions/state";

/**
 * Anything destructive or hard to undo goes through here: the consequence is
 * spelled out, and the action only runs after an explicit confirmation.
 */
export function ConfirmAction({
  children,
  action,
  hidden,
  title,
  description,
  confirmLabel = "Confirm",
  open,
  onOpenChange,
}: {
  children?: React.ReactNode;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** Hidden form values passed to the action. */
  hidden: Record<string, string>;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = open ?? internalOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (open === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [open, onOpenChange],
  );

  // The action refuses some deletes on purpose — "this project still has
  // receipts" — so a failure closes the dialog and surfaces the reason.
  const { formAction, pending } = useActionForm(action, {
    onSuccess: () => setOpen(false),
    onError: (settled) => {
      if (settled.message) toast.error(settled.message);
      setOpen(false);
    },
  });

  return (
    <AlertDialog open={isOpen} onOpenChange={setOpen}>
      {children}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction}>
          {Object.entries(hidden).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" disabled={pending}>
              {pending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** A single-button form for reversible actions that need no confirmation. */
export function InlineAction({
  action,
  hidden,
  children,
  className,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  hidden: Record<string, string>;
  children: React.ReactNode;
  className?: string;
}) {
  const { formAction, pending } = useActionForm(action);

  return (
    <form action={formAction} className={className}>
      {Object.entries(hidden).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center gap-2 disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {children}
      </button>
    </form>
  );
}
