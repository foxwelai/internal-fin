"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn, signOut } from "@/lib/auth";

import { failure, formValue, type ActionState } from "./helpers";

/**
 * Sign-in and sign-out navigate with Next's own `redirect()` rather than
 * Auth.js's `redirectTo`.
 *
 * Auth.js resolves `redirectTo` into an *absolute* URL, and when AUTH_URL (or
 * NEXTAUTH_URL) is set it uses that as the origin. A value left over from local
 * development therefore sends people on the deployed site to localhost. Next's
 * `redirect()` emits a relative Location, so the browser always stays on
 * whichever host actually served the request — the deployment, a Vercel preview
 * URL, or localhost — with nothing to configure.
 */

const AFTER_SIGN_IN = "/overview";
const AFTER_SIGN_OUT = "/login";

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
    // `redirect: false` makes signIn set the session cookie and return the URL
    // it would have gone to, instead of redirecting to an Auth.js-constructed
    // absolute URL. Bad credentials throw an AuthError; the returned URL is
    // checked as well, so a future version that stops throwing cannot turn a
    // failed sign-in into an apparent success.
    const result = await signIn("credentials", { email, password, redirect: false });
    if (typeof result === "string" && new URL(result, "http://localhost").searchParams.has("error")) {
      return failure("That email and password combination was not recognised.");
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return failure("That email and password combination was not recognised.");
    }
    console.error("[signIn]", error);
    return failure("Could not sign you in. Check the database connection and try again.");
  }

  // Outside the catch: redirect() signals by throwing, and must not be swallowed.
  redirect(AFTER_SIGN_IN);
}

export async function signOutAction() {
  await signOut({ redirect: false });
  redirect(AFTER_SIGN_OUT);
}
