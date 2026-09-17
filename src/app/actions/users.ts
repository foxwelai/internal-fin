"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";

import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/permissions";
import { addUserSchema } from "@/lib/validation/users";
import type { UserRole } from "@/generated/prisma";

import {
  failure,
  formValue,
  fromZodError,
  runAction,
  success,
  type ActionState,
} from "./helpers";

/**
 * People and access. Only a super admin reaches any of these.
 *
 * Sign-in belongs to Clerk, so nothing here touches a password. What lives
 * here is the decision Clerk cannot make: whether a signed-in person may see
 * the company's finances, and with which role.
 */

function revalidateTeam() {
  // The layout reads access on every request; refresh everything so an
  // approval reaches the person without them reloading twice.
  revalidatePath("/", "layout");
}

/**
 * Guards the last way back in. Demoting, deactivating or deleting the only
 * active super admin would leave nobody able to approve anyone, with no fix
 * short of a database console.
 */
async function isLastSuperAdmin(userId: string): Promise<boolean> {
  const others = await prisma.user.count({
    where: {
      role: "SUPER_ADMIN",
      isActive: true,
      approvedAt: { not: null },
      id: { not: userId },
    },
  });
  return others === 0;
}

/**
 * Let someone in ahead of time. They are approved with this role the first
 * time they sign in to Clerk with this email — once Clerk has verified it.
 */
export async function addUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("users:manage");

    const parsed = addUserSchema.safeParse({
      name: formValue(formData, "name"),
      email: formValue(formData, "email"),
      role: formValue(formData, "role"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const { name, email, role } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return failure(
        existing.approvedAt
          ? `${email} already has access.`
          : `${email} has already asked for access — approve them under Pending requests.`,
        { email: ["Already known"] },
      );
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        role: role as UserRole,
        approvedAt: new Date(),
        approvedById: actor.id,
        createdById: actor.id,
      },
    });

    revalidateTeam();
    return success(
      `${user.name} can now sign in with ${user.email} as ${ROLE_LABELS[user.role]}.`,
      user.id,
    );
  });
}

const ACCESS_LEVELS = ["NONE", "SUPER_ADMIN", "ADMIN", "VIEWER"] as const;
type AccessLevel = (typeof ACCESS_LEVELS)[number];

/**
 * The role dropdown on the Team page: set anyone's access in one step — someone
 * who just signed up, a member, or a person previously refused.
 *
 * The person is identified by their Clerk id or access record id. Their email is
 * always taken from Clerk on the server, never from the form, so the dropdown
 * cannot be used to grant a role to an address the person does not own.
 */
export async function setPersonAccess(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("users:manage");

    const access = formValue(formData, "access") as AccessLevel;
    const userId = formValue(formData, "userId") || null;
    const clerkUserId = formValue(formData, "clerkUserId") || null;

    if (!ACCESS_LEVELS.includes(access)) return failure("Choose a valid access level.");
    if (!userId && !clerkUserId) return failure("Missing person reference.");

    let record = userId
      ? await prisma.user.findUnique({ where: { id: userId } })
      : await prisma.user.findUnique({ where: { clerkUserId: clerkUserId! } });

    if (record && record.id === actor.id) {
      return failure("You can't change your own access. Ask another super admin.");
    }

    const losingSuperAdmin =
      record?.role === "SUPER_ADMIN" &&
      record.isActive &&
      record.approvedAt !== null &&
      access !== "SUPER_ADMIN";
    if (record && losingSuperAdmin && (await isLastSuperAdmin(record.id))) {
      return failure(
        `${record.name} is the only active super admin. Make someone else a super admin first, otherwise nobody could manage access.`,
      );
    }

    // Someone who signed up but has no record yet: build one from Clerk's data.
    if (!record) {
      const clerk = await clerkClient();
      let clerkUser;
      try {
        clerkUser = await clerk.users.getUser(clerkUserId!);
      } catch {
        return failure("That person no longer exists in Clerk.");
      }

      const primary = clerkUser.emailAddresses.find(
        (address) => address.id === clerkUser.primaryEmailAddressId,
      );
      const email = primary?.emailAddress.trim().toLowerCase();
      if (!email) return failure("This person has no email address in Clerk, so access can't be recorded.");

      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail?.clerkUserId && byEmail.clerkUserId !== clerkUser.id) {
        return failure(`${email} is already linked to a different sign-in.`);
      }

      const name =
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
        clerkUser.username ||
        email.split("@")[0];

      record = byEmail
        ? await prisma.user.update({ where: { id: byEmail.id }, data: { clerkUserId: clerkUser.id } })
        : await prisma.user.create({
            data: { clerkUserId: clerkUser.id, email, name, role: "VIEWER", isActive: true },
          });
    }

    if (access === "NONE") {
      const user = await prisma.user.update({
        where: { id: record.id },
        data: { isActive: false },
      });
      revalidateTeam();
      return success(`${user.name} no longer has access. They'll see no data on their next request.`);
    }

    const user = await prisma.user.update({
      where: { id: record.id },
      data: {
        role: access,
        isActive: true,
        approvedAt: record.approvedAt ?? new Date(),
        approvedById: record.approvedAt ? record.approvedById : actor.id,
      },
    });

    revalidateTeam();
    return success(
      record.approvedAt && record.isActive
        ? `${user.name} is now ${ROLE_LABELS[user.role]}.`
        : `${user.name} now has ${ROLE_LABELS[user.role]} access. They get in on their next page load.`,
    );
  });
}
