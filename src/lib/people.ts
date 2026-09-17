/**
 * Everyone who could be given access, in one list.
 *
 * Clerk knows who has signed up; the `users` table knows what each person may
 * do. Neither list alone is complete: someone can sign up and never open the
 * app (in Clerk, not in the table), and a super admin can approve an email
 * before that person signs up (in the table, not in Clerk). This merges the two
 * — pure, so the matching rules are pinned down by tests.
 */

import type { UserRole } from "@/generated/prisma";

export type AccessLevel = "NONE" | UserRole;

export type PersonState =
  /** Signed up or asked for access, and nobody has decided yet. */
  | "needs-access"
  /** Has a role and can get in. */
  | "approved"
  /** Approved by email, but has not signed up with Clerk yet. */
  | "invited"
  /** Turned down, or had access switched off. */
  | "no-access";

export type ClerkPerson = {
  clerkUserId: string;
  email: string | null;
  emailVerified: boolean;
  name: string;
  imageUrl: string | null;
  signedUpAt: Date;
  lastSignInAt: Date | null;
};

export type AccessRecord = {
  id: string;
  clerkUserId: string | null;
  email: string;
  name: string;
  role: UserRole;
  approvedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
};

export type Person = {
  /** Stable React key and form reference. */
  key: string;
  clerkUserId: string | null;
  userId: string | null;
  name: string;
  email: string | null;
  imageUrl: string | null;
  signedUpAt: Date | null;
  lastSignInAt: Date | null;
  state: PersonState;
  access: AccessLevel;
};

function accessOf(record: AccessRecord | null): { state: PersonState; access: AccessLevel } {
  if (!record) return { state: "needs-access", access: "NONE" };
  if (!record.isActive) return { state: "no-access", access: "NONE" };
  if (record.approvedAt === null) return { state: "needs-access", access: "NONE" };
  return { state: "approved", access: record.role };
}

const STATE_ORDER: Record<PersonState, number> = {
  "needs-access": 0,
  approved: 1,
  invited: 2,
  "no-access": 3,
};

export function mergePeople(clerkPeople: readonly ClerkPerson[], records: readonly AccessRecord[]): Person[] {
  const byClerkId = new Map(
    records.filter((record) => record.clerkUserId).map((record) => [record.clerkUserId!, record]),
  );
  // Only records not yet tied to a Clerk account can be matched by email.
  const unlinkedByEmail = new Map(
    records.filter((record) => !record.clerkUserId).map((record) => [record.email.toLowerCase(), record]),
  );

  const used = new Set<string>();
  const people: Person[] = [];

  for (const clerkPerson of clerkPeople) {
    let record = byClerkId.get(clerkPerson.clerkUserId) ?? null;

    // A pre-approved email is claimed only by a verified address — the same
    // rule sign-in applies, so the list never shows a match sign-in would refuse.
    if (!record && clerkPerson.email && clerkPerson.emailVerified) {
      record = unlinkedByEmail.get(clerkPerson.email.toLowerCase()) ?? null;
    }
    if (record) used.add(record.id);

    const { state, access } = accessOf(record);
    people.push({
      key: `clerk:${clerkPerson.clerkUserId}`,
      clerkUserId: clerkPerson.clerkUserId,
      userId: record?.id ?? null,
      name: record?.name ?? clerkPerson.name,
      email: clerkPerson.email ?? record?.email ?? null,
      imageUrl: clerkPerson.imageUrl,
      signedUpAt: clerkPerson.signedUpAt,
      lastSignInAt: clerkPerson.lastSignInAt,
      state,
      access,
    });
  }

  // Records with no Clerk account behind them.
  for (const record of records) {
    if (used.has(record.id)) continue;
    const { state, access } = accessOf(record);
    people.push({
      key: `user:${record.id}`,
      clerkUserId: record.clerkUserId,
      userId: record.id,
      name: record.name,
      email: record.email,
      imageUrl: null,
      signedUpAt: null,
      lastSignInAt: null,
      // Approved but never signed in is an invitation still waiting to be used.
      state: state === "approved" && !record.clerkUserId ? "invited" : state,
      access,
    });
  }

  return people.sort(
    (a, b) =>
      STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
      (b.signedUpAt?.getTime() ?? 0) - (a.signedUpAt?.getTime() ?? 0) ||
      a.name.localeCompare(b.name),
  );
}
