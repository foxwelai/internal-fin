"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/permissions";
import {
  addUserSchema,
  approveUserSchema,
  setUserActiveSchema,
  updateUserSchema,
} from "@/lib/validation/users";
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

/** Grant a pending request, choosing the role at the same moment. */
export async function approveUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("users:manage");

    const parsed = approveUserSchema.safeParse({
      id: formValue(formData, "id"),
      role: formValue(formData, "role"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const target = await prisma.user.findUnique({ where: { id: parsed.data.id } });
    if (!target) return failure("That request no longer exists.");

    const user = await prisma.user.update({
      where: { id: target.id },
      data: {
        role: parsed.data.role as UserRole,
        approvedAt: new Date(),
        approvedById: actor.id,
        isActive: true,
      },
    });

    revalidateTeam();
    return success(
      `${user.name} approved as ${ROLE_LABELS[user.role]}. They get in on their next page load.`,
    );
  });
}

/** Turn down a request. Kept rather than deleted, so it is not re-raised on the next sign-in. */
export async function declineUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("users:manage");

    const id = formValue(formData, "id");
    if (!id) return failure("Missing request reference.");
    if (id === actor.id) return failure("You cannot decline your own access.");

    const user = await prisma.user.update({
      where: { id },
      data: { isActive: false, approvedAt: null, approvedById: null },
    });

    revalidateTeam();
    return success(`${user.name}'s request was declined. They will see no data.`);
  });
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

export async function updateUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("users:manage");

    const parsed = updateUserSchema.safeParse({
      id: formValue(formData, "id"),
      name: formValue(formData, "name"),
      role: formValue(formData, "role"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const { id, name, role } = parsed.data;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return failure("That account no longer exists.");

    if (target.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN" && (await isLastSuperAdmin(id))) {
      return failure(
        `${target.name} is the only active super admin. Make someone else a super admin first, otherwise nobody could approve people.`,
        { role: ["The last super admin cannot be demoted"] },
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data: { name, role: role as UserRole },
    });

    revalidateTeam();
    return success(`${user.name} is now ${ROLE_LABELS[user.role]}.`);
  });
}

export async function setUserActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("users:manage");

    const parsed = setUserActiveSchema.safeParse({
      id: formValue(formData, "id"),
      active: formValue(formData, "active"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const { id } = parsed.data;
    const active = parsed.data.active === "true";

    if (!active && id === actor.id) return failure("You cannot deactivate your own account.");

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return failure("That account no longer exists.");

    if (!active && target.role === "SUPER_ADMIN" && (await isLastSuperAdmin(id))) {
      return failure(`${target.name} is the only active super admin. Promote someone else first.`);
    }

    const user = await prisma.user.update({ where: { id }, data: { isActive: active } });

    revalidateTeam();
    return success(
      active
        ? `${user.name} can get in again.`
        : `${user.name} is deactivated and loses access on their next request.`,
    );
  });
}

export async function deleteUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("users:manage");

    const id = formValue(formData, "id");
    if (!id) return failure("Missing account reference.");
    if (id === actor.id) return failure("You cannot delete your own account.");

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return failure("That account no longer exists.");

    if (target.role === "SUPER_ADMIN" && (await isLastSuperAdmin(id))) {
      return failure(`${target.name} is the only active super admin and cannot be removed.`);
    }

    await prisma.user.delete({ where: { id } });

    revalidateTeam();
    return success(
      `${target.name} was removed. If they sign in again they will appear as a new request.`,
    );
  });
}
