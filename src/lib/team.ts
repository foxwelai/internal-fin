import "server-only";

import { cache } from "react";
import { clerkClient } from "@clerk/nextjs/server";

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { mergePeople, type ClerkPerson, type Person } from "@/lib/people";

/** A few hundred is far beyond an internal team; the cap bounds a runaway list. */
const CLERK_PAGE = 100;
const CLERK_MAX = 500;

async function fetchClerkPeople(): Promise<ClerkPerson[]> {
  const client = await clerkClient();
  const people: ClerkPerson[] = [];

  for (let offset = 0; offset < CLERK_MAX; offset += CLERK_PAGE) {
    const { data } = await client.users.getUserList({
      limit: CLERK_PAGE,
      offset,
      orderBy: "-created_at",
    });

    for (const user of data) {
      const primary = user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId);
      const email = primary?.emailAddress.trim().toLowerCase() ?? null;
      people.push({
        clerkUserId: user.id,
        email,
        emailVerified: primary?.verification?.status === "verified",
        name:
          [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
          user.username ||
          email?.split("@")[0] ||
          "Unnamed",
        imageUrl: user.hasImage ? user.imageUrl : null,
        signedUpAt: new Date(user.createdAt),
        lastSignInAt: user.lastSignInAt ? new Date(user.lastSignInAt) : null,
      });
    }

    if (data.length < CLERK_PAGE) break;
  }

  return people;
}

export type TeamView = {
  people: Person[];
  activeSuperAdmins: number;
  /** Set when Clerk could not be reached; the list then shows database records only. */
  clerkError: string | null;
};

/**
 * Everyone who has signed up with Clerk or been given access, with what each
 * may do. Super admins only — this reads every account's email.
 */
export const loadTeamView = cache(async (): Promise<TeamView> => {
  await requirePermission("users:manage");

  const records = await prisma.user.findMany({
    select: {
      id: true,
      clerkUserId: true,
      email: true,
      name: true,
      role: true,
      approvedAt: true,
      isActive: true,
      createdAt: true,
    },
  });

  let clerkPeople: ClerkPerson[] = [];
  let clerkError: string | null = null;
  try {
    clerkPeople = await fetchClerkPeople();
  } catch (error) {
    // Access decisions still work from the database; only the list of people
    // who signed up but never opened the app is missing.
    console.error("[team] could not list Clerk users", error);
    clerkError =
      "Couldn't reach Clerk, so people who signed up but never opened the app aren't shown. Everyone with an access record is.";
  }

  return {
    people: mergePeople(clerkPeople, records),
    activeSuperAdmins: records.filter(
      (record) => record.role === "SUPER_ADMIN" && record.isActive && record.approvedAt !== null,
    ).length,
    clerkError,
  };
});
