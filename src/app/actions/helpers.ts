import { revalidatePath } from "next/cache";

import { ForbiddenError, UnauthorizedError } from "@/lib/auth";

import { failure, type ActionState } from "./state";

export { IDLE, failure, fromZodError, success } from "./state";
export type { ActionState } from "./state";

/**
 * Wraps an action body so an unexpected throw becomes a readable message
 * rather than a Next.js error overlay, and an auth failure is never confused
 * with a validation failure.
 */
export async function runAction(body: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await body();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return failure(
        "Your session is no longer valid — the account may have been signed out or deactivated. Sign in again.",
      );
    }
    // A real answer about what the role cannot do, not a generic "denied".
    if (error instanceof ForbiddenError) return failure(error.message);
    if (error instanceof Error && error.message.startsWith("VALIDATION:")) {
      return failure(error.message.slice("VALIDATION:".length).trim());
    }
    // `redirect()` and `notFound()` signal by throwing; let those through.
    if (error instanceof Error && "digest" in error && typeof error.digest === "string") {
      throw error;
    }
    console.error("[action]", error);
    return failure("Something went wrong saving that. Nothing was changed — please try again.");
  }
}

/** Financial figures appear on every screen, so a write refreshes them all. */
export function revalidateFinance() {
  revalidatePath("/", "layout");
}

export function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
