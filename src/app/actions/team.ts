"use server";

import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { teamMemberSchema } from "@/lib/validation/schemas";

import {
  failure,
  formValue,
  fromZodError,
  revalidateFinance,
  runAction,
  success,
  type ActionState,
} from "./helpers";

/**
 * Foxwel's own people, as assigned to projects. Anyone who can record
 * financial data can keep this list current — it is who to call, not who may
 * sign in, which stays with super admins under Team access.
 */

export async function saveTeamMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const parsed = teamMemberSchema.safeParse({
      id: formValue(formData, "id") || undefined,
      kind: formValue(formData, "kind") || "EMPLOYEE",
      name: formValue(formData, "name"),
      phone: formValue(formData, "phone"),
      designation: formValue(formData, "designation"),
      email: formValue(formData, "email"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const { id, ...data } = parsed.data;

    if (id) {
      await prisma.teamMember.update({ where: { id }, data });
      revalidateFinance();
      return success(`${data.name} updated.`);
    }

    const created = await prisma.teamMember.create({ data });
    revalidateFinance();
    return success(
      data.kind === "INTERN" ? `${data.name} added as an intern.` : `${data.name} added to the team.`,
      created.id,
    );
  });
}

export async function setTeamMemberActive(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const id = formValue(formData, "id");
    const active = formValue(formData, "active") === "true";
    if (!id) return failure("Missing team member reference.");

    // Leaving keeps their name on the projects they coordinated; they simply
    // stop being offered for new ones.
    const member = await prisma.teamMember.update({ where: { id }, data: { isActive: active } });
    revalidateFinance();
    return success(active ? `${member.name} is back on the team.` : `${member.name} marked as left.`);
  });
}

export async function deleteTeamMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:delete");

    const id = formValue(formData, "id");
    if (!id) return failure("Missing team member reference.");

    const member = await prisma.teamMember.findUnique({
      where: { id },
      include: { _count: { select: { coordinatedProjects: true } } },
    });
    if (!member) return failure("That person is no longer on the list.");

    if (member._count.coordinatedProjects > 0) {
      return failure(
        `${member.name} coordinates ${member._count.coordinatedProjects} project(s). Mark them as left ` +
          "instead, so those projects keep their point of contact.",
      );
    }

    await prisma.teamMember.delete({ where: { id } });
    revalidateFinance();
    return success(`${member.name} removed.`);
  });
}
