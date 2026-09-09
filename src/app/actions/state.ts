import type { z } from "zod";

/**
 * The shape every server action returns, and the only part of the action layer
 * a client component may import — it pulls in no server-only module, so a form
 * can reference it without dragging Prisma or `next/cache` into the browser
 * bundle.
 */
export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /** Set on success so a dialog can navigate to what it just created. */
  createdId?: string;
};

export const IDLE: ActionState = { status: "idle" };

export function success(message: string, createdId?: string): ActionState {
  return { status: "success", message, createdId };
}

export function failure(message: string, fieldErrors?: Record<string, string[]>): ActionState {
  return { status: "error", message, fieldErrors };
}

/** Turns a Zod failure into per-field messages the form can render inline. */
export function fromZodError(error: z.ZodError): ActionState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  const first = error.issues[0]?.message ?? "Please check the highlighted fields.";
  return { status: "error", message: first, fieldErrors };
}
