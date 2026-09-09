"use server";

import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { signIn, signOut } from "@/lib/auth";

import { failure, formValue, type ActionState } from "./helpers";

export async function signInWithCredentials(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = formValue(formData, "email");
  const password = formValue(formData, "password");

  if (!email || !password) {
    return failure("Enter your email and password.", {
      ...(email ? {} : { email: ["Required"] }),
      ...(password ? {} : { password: ["Required"] }),
    });
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/overview" });
    return { status: "success" };
  } catch (error) {
    // A successful sign-in redirects by throwing; let that through.
    if (isRedirectError(error)) throw error;
    if (error instanceof AuthError) {
      return failure("That email and password combination was not recognised.");
    }
    console.error("[signIn]", error);
    return failure("Could not sign you in. Check the database connection and try again.");
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
