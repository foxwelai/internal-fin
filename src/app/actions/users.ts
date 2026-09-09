"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/permissions";
import {
  createUserSchema,
  resetPasswordSchema,
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

const BCRYPT_COST = 12;

function revalidateTeam() {
  revalidatePath("/settings");
}

/**
 * Guards the last way back in.
 *
 * Demoting, deactivating or deleting the only active owner would leave the
 * installation with nobody able to manage people or settings, and no way to fix
 * it short of a database console. Every path that could do that goes through
 * here first.
 */
async function wouldStrandInstallation(userId: string): Promise<boolean> {
  const otherActiveOwners = await prisma.user.count({
    where: { role: "OWNER", isActive: true, id: { not: userId } },
  });
  return otherActiveOwners === 0;
}

export async function createUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("users:manage");

    const parsed = createUserSchema.safeParse({
      name: formValue(formData, "name"),
      email: formValue(formData, "email"),
      role: formValue(formData, "role"),
      password: formValue(formData, "password"),
      confirmPassword: formValue(formData, "confirmPassword"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const { name, email, role, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return failure(`${email} already has an account.`, { email: ["Already in use"] });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        role: role as UserRole,
        passwordHash: await bcrypt.hash(password, BCRYPT_COST),
        createdById: actor.id,
      },
    });

    revalidateTeam();
    return success(
      `${user.name} added as ${ROLE_LABELS[user.role]}. Share the password with them and ask them to change it from Settings.`,
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

    const losingOwnership = target.role === "OWNER" && role !== "OWNER";
    if (losingOwnership && (await wouldStrandInstallation(id))) {
      return failure(
        `${target.name} is the only active owner. Make someone else an owner first, otherwise nobody could manage people or settings.`,
        { role: ["The last owner cannot be demoted"] },
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

    if (!active && id === actor.id) {
      return failure("You cannot deactivate your own account.");
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return failure("That account no longer exists.");

    if (!active && target.role === "OWNER" && (await wouldStrandInstallation(id))) {
      return failure(
        `${target.name} is the only active owner. Promote someone else first.`,
      );
    }

    const user = await prisma.user.update({ where: { id }, data: { isActive: active } });

    revalidateTeam();
    return success(
      active
        ? `${user.name} can sign in again.`
        : `${user.name} is deactivated and loses access on their next request. Their history is kept.`,
    );
  });
}

export async function resetUserPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("users:manage");

    const parsed = resetPasswordSchema.safeParse({
      id: formValue(formData, "id"),
      password: formValue(formData, "password"),
      confirmPassword: formValue(formData, "confirmPassword"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const target = await prisma.user.findUnique({ where: { id: parsed.data.id } });
    if (!target) return failure("That account no longer exists.");

    await prisma.user.update({
      where: { id: target.id },
      data: { passwordHash: await bcrypt.hash(parsed.data.password, BCRYPT_COST) },
    });

    revalidateTeam();
    return success(
      `Password reset for ${target.name}. Their existing sessions stay valid until they expire — deactivate and reactivate the account to cut them off immediately.`,
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

    if (target.role === "OWNER" && (await wouldStrandInstallation(id))) {
      return failure(`${target.name} is the only active owner and cannot be deleted.`);
    }

    await prisma.user.delete({ where: { id } });

    revalidateTeam();
    return success(`${target.name}'s account was deleted.`);
  });
}
