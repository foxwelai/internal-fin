import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { accessStateOf, decideLink, type AccessState } from "@/lib/access";
import { can, forbiddenMessage, type Permission } from "@/lib/permissions";
import type { User, UserRole } from "@/generated/prisma";

/**
 * Clerk handles sign-in, sessions, passwords and MFA. This file turns a Clerk
 * session into an account in our `users` table, and that row — not Clerk, not
 * the token — decides whether the person sees anything and with which role.
 * It is read fresh on every request, so an approval, a role change or a
 * deactivation takes effect on the very next click.
 */

export class UnauthorizedError extends Error {
  constructor(message = "You must be signed in to do that.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export type CurrentUser = Pick<User, "id" | "email" | "name" | "role" | "isActive" | "approvedAt">;

export type Account =
  | { state: "signed-out" }
  /** Signed in to Clerk, but we could not safely tie it to an account. */
  | { state: "unlinked"; reason: "unverified-email" | "no-email" | "email-owned-by-another-account"; email: string | null }
  | { state: AccessState; user: CurrentUser };

const USER_FIELDS = {
  id: true,
  clerkUserId: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  approvedAt: true,
} as const;

/**
 * The signed-in person and where they stand. `cache()` makes this one lookup
 * per request however many components and actions ask.
 */
export const getAccount = cache(async (): Promise<Account> => {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { state: "signed-out" };

  // The common path: already linked. One indexed query, no call to Clerk.
  const linked = await prisma.user.findUnique({ where: { clerkUserId }, select: USER_FIELDS });
  if (linked) return { state: accessStateOf(linked), user: linked };

  // First sign-in for this Clerk account — ask Clerk who it is.
  const clerkUser = await currentUser();
  const primary = clerkUser?.emailAddresses.find(
    (address) => address.id === clerkUser.primaryEmailAddressId,
  );
  const email = primary?.emailAddress.trim().toLowerCase() ?? null;
  const name =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ").trim() ||
    clerkUser?.username ||
    email?.split("@")[0] ||
    "New user";

  const byEmail = email
    ? await prisma.user.findUnique({ where: { email }, select: USER_FIELDS })
    : null;

  const decision = decideLink(
    {
      clerkUserId,
      email,
      emailVerified: primary?.verification?.status === "verified",
      name,
    },
    null,
    byEmail,
  );

  switch (decision.kind) {
    case "refuse":
      return { state: "unlinked", reason: decision.reason, email };

    case "claim": {
      const user = await prisma.user.update({
        where: { id: decision.userId },
        data: { clerkUserId, lastLoginAt: new Date() },
        select: USER_FIELDS,
      });
      return { state: accessStateOf(user), user };
    }

    case "request": {
      try {
        const user = await prisma.user.create({
          data: { clerkUserId, email: decision.email, name: decision.name, role: "VIEWER" },
          select: USER_FIELDS,
        });
        return { state: accessStateOf(user), user };
      } catch {
        // Two tabs signing in at once both try to create the row. The loser
        // just reads what the winner wrote.
        const user = await prisma.user.findUnique({ where: { clerkUserId }, select: USER_FIELDS });
        if (!user) throw new Error("Could not record the access request.");
        return { state: accessStateOf(user), user };
      }
    }

    case "linked":
      // Unreachable: the linked lookup above already returned.
      throw new Error("Unexpected link state.");
  }
});

/** The approved account, or null. Pages and routes use this. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const account = await getAccount();
  return account.state === "approved" ? account.user : null;
}

/**
 * Server-side gate for every protected read and mutation. Server Actions are
 * public HTTP endpoints, so each one calls this itself — the proxy only
 * redirects signed-out visitors, which is not authorization.
 */
export async function requireUser(): Promise<CurrentUser> {
  const account = await getAccount();
  if (account.state === "signed-out") throw new UnauthorizedError();
  if (account.state !== "approved") {
    throw new ForbiddenError("Your access has not been approved yet.");
  }
  return account.user;
}

/**
 * The page-rendering variant, used by the data loaders. A signed-out visitor is
 * sent to sign in rather than shown an error; an unapproved one is refused, and
 * the layout shows them the waiting screen instead of the page.
 */
export async function requirePageUser(): Promise<CurrentUser> {
  const account = await getAccount();
  if (account.state === "signed-out") redirect("/sign-in");
  if (account.state !== "approved") {
    throw new ForbiddenError("Your access has not been approved yet.");
  }
  return account.user;
}

/** As `requireUser`, and additionally that the role carries `permission`. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) {
    throw new ForbiddenError(forbiddenMessage(user.role, permission));
  }
  return user;
}

export type { Permission, UserRole };
