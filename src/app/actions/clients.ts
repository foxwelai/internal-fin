"use server";

import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { clientSchema } from "@/lib/validation/schemas";

import {
  failure,
  formValue,
  fromZodError,
  revalidateFinance,
  runAction,
  success,
  type ActionState,
} from "./helpers";

export async function saveClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const parsed = clientSchema.safeParse({
      id: formValue(formData, "id") || undefined,
      name: formValue(formData, "name"),
      clientName: formValue(formData, "clientName"),
      phone: formValue(formData, "phone"),
      contactPerson: formValue(formData, "contactPerson"),
      contactPhone: formValue(formData, "contactPhone"),
      companyName: formValue(formData, "companyName"),
      website: formValue(formData, "website"),
      email: formValue(formData, "email"),
      notes: formValue(formData, "notes"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const { id, ...data } = parsed.data;

    if (id) {
      await prisma.client.update({ where: { id }, data });
      revalidateFinance();
      return success(`${data.name} updated.`);
    }

    const created = await prisma.client.create({ data });
    revalidateFinance();
    return success(`${data.name} added.`, created.id);
  });
}

export async function setClientArchived(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const id = formValue(formData, "id");
    const archive = formValue(formData, "archive") === "true";
    if (!id) return failure("Missing client reference.");

    const client = await prisma.client.update({
      where: { id },
      data: { archivedAt: archive ? new Date() : null },
    });

    // Archiving is reversible and touches no history: projects, schedules and
    // receipts all stay exactly as they were.
    revalidateFinance();
    return success(archive ? `${client.name} archived.` : `${client.name} restored.`);
  });
}

export async function deleteClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:delete");

    const id = formValue(formData, "id");
    if (!id) return failure("Missing client reference.");

    const client = await prisma.client.findUnique({
      where: { id },
      include: { _count: { select: { projects: true } } },
    });
    if (!client) return failure("That client no longer exists.");

    if (client._count.projects > 0) {
      return failure(
        `${client.name} still has ${client._count.projects} project(s). Archive the client instead — ` +
          "deleting would remove their payment history with it.",
      );
    }

    await prisma.client.delete({ where: { id } });
    revalidateFinance();
    redirect("/clients");
  });
}
