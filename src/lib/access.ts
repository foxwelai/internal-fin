/**
 * Who gets in.
 *
 * Clerk proves *who* someone is. This module decides whether that person may
 * see anything, and it is deliberately pure — plain data in, a decision out —
 * so the rules can be pinned down by tests rather than trusted.
 */

import type { UserRole } from "@/generated/prisma";

export type AccessState =
  /** Approved and active: the app opens. */
  | "approved"
  /** Signed up, waiting for a super admin. */
  | "pending"
  /** A super admin turned the request down. */
  | "declined"
  /** Was approved, has since been switched off. */
  | "deactivated";

export type AccessRow = {
  approvedAt: Date | null;
  isActive: boolean;
};

export function accessStateOf(row: AccessRow): AccessState {
  if (row.approvedAt === null) return row.isActive ? "pending" : "declined";
  return row.isActive ? "approved" : "deactivated";
}

export type ClerkIdentity = {
  clerkUserId: string;
  /** Primary email, lower-cased. */
  email: string | null;
  /** Only a verified address may be matched to an existing account. */
  emailVerified: boolean;
  name: string;
};

export type KnownUser = {
  id: string;
  clerkUserId: string | null;
  email: string;
  role: UserRole;
  approvedAt: Date | null;
  isActive: boolean;
};

export type LinkDecision =
  /** Already linked to this Clerk account. */
  | { kind: "linked"; userId: string }
  /** An existing row with this email, not yet tied to any Clerk account. */
  | { kind: "claim"; userId: string }
  /** Nobody we know: record a request for a super admin to review. */
  | { kind: "request"; email: string; name: string }
  /** Cannot be resolved safely — see `reason`. */
  | { kind: "refuse"; reason: "unverified-email" | "no-email" | "email-owned-by-another-account" };

/**
 * Decide how a signed-in Clerk identity maps onto our users.
 *
 * The one rule that matters for security: an email only ever *claims* an
 * existing account when Clerk has verified it. Otherwise anyone could sign up
 * as work@foxwel.ai with an address they do not control and inherit the super
 * admin row.
 */
export function decideLink(
  identity: ClerkIdentity,
  byClerkId: KnownUser | null,
  byEmail: KnownUser | null,
): LinkDecision {
  if (byClerkId) return { kind: "linked", userId: byClerkId.id };

  if (!identity.email) return { kind: "refuse", reason: "no-email" };
  if (!identity.emailVerified) return { kind: "refuse", reason: "unverified-email" };

  if (byEmail) {
    // Tied to a different Clerk account already — never silently re-point it.
    if (byEmail.clerkUserId && byEmail.clerkUserId !== identity.clerkUserId) {
      return { kind: "refuse", reason: "email-owned-by-another-account" };
    }
    return { kind: "claim", userId: byEmail.id };
  }

  return { kind: "request", email: identity.email, name: identity.name };
}
