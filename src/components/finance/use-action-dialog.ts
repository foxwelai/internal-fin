"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { IDLE, type ActionState } from "@/app/actions/state";

type Callbacks = {
  onSuccess?: (state: ActionState) => void;
  onError?: (state: ActionState) => void;
};

/**
 * Runs the settle callbacks exactly once per action result.
 *
 * Callbacks are held in a ref rather than listed as effect dependencies, so a
 * caller passing an inline arrow does not re-fire the effect on every render.
 */
function useSettled(state: ActionState, callbacks: Callbacks) {
  const latest = useRef(callbacks);
  useEffect(() => {
    latest.current = callbacks;
  });

  const handled = useRef<ActionState | null>(null);

  useEffect(() => {
    if (state.status === "idle" || handled.current === state) return;
    handled.current = state;
    if (state.status === "success") latest.current.onSuccess?.(state);
    else latest.current.onError?.(state);
  }, [state]);
}

/**
 * Wires a server action to a dialog: the form stays open showing inline errors
 * when validation fails, and closes with a toast when the write succeeds.
 */
export function useActionDialog(
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>,
  options: Callbacks = {},
) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const [open, setOpen] = useState(false);

  useSettled(state, {
    onSuccess: (settled) => {
      if (settled.message) toast.success(settled.message);
      setOpen(false);
      options.onSuccess?.(settled);
    },
    onError: options.onError,
  });

  return { state, formAction, pending, open, setOpen };
}

/** Same contract for forms that live on a page rather than in a dialog. */
export function useActionForm(
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>,
  options: Callbacks & { successToast?: boolean } = {},
) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const { successToast = true } = options;

  useSettled(state, {
    onSuccess: (settled) => {
      if (successToast && settled.message) toast.success(settled.message);
      options.onSuccess?.(settled);
    },
    onError: options.onError,
  });

  return { state, formAction, pending };
}
