"use server";

import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayInIST } from "@/lib/dates";
import { EDITABLE_LEAD_STAGES, leadSchema } from "@/lib/validation/schemas";

import {
  failure,
  formValue,
  fromZodError,
  revalidateFinance,
  runAction,
  success,
  type ActionState,
} from "./helpers";

export async function saveLead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const parsed = leadSchema.safeParse({
      id: formValue(formData, "id") || undefined,
      name: formValue(formData, "name"),
      clientName: formValue(formData, "clientName"),
      phone: formValue(formData, "phone"),
      contactPerson: formValue(formData, "contactPerson"),
      contactPhone: formValue(formData, "contactPhone"),
      email: formValue(formData, "email"),
      website: formValue(formData, "website"),
      stage: formValue(formData, "stage") || "JUST_SPOKE",
      quality: formValue(formData, "quality") || "WARM",
      source: formValue(formData, "source"),
      expectedValue: formValue(formData, "expectedValue"),
      expectedCloseMonth: formValue(formData, "expectedCloseMonth"),
      requirement: formValue(formData, "requirement"),
      ownerId: formValue(formData, "ownerId"),
      nextFollowUpOn: formValue(formData, "nextFollowUpOn"),
      lostReason: formValue(formData, "lostReason"),
      notes: formValue(formData, "notes"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const { id, expectedValue, stage, lostReason, ...rest } = parsed.data;

    if (rest.ownerId && !(await prisma.teamMember.findUnique({ where: { id: rest.ownerId } }))) {
      return failure("That person is no longer on the team list.", { ownerId: ["Not on the team list"] });
    }

    const existing = id
      ? await prisma.lead.findUnique({ where: { id }, select: { stage: true, closedOn: true } })
      : null;
    if (id && !existing) return failure("That lead no longer exists.");

    const data = {
      ...rest,
      expectedValuePaise: expectedValue,
      lostReason: stage === "LOST" ? lostReason : null,
    };

    if (existing?.stage === "WON") {
      // Already a client: the details can be tidied, the outcome can't be undone.
      await prisma.lead.update({ where: { id }, data });
      revalidateFinance();
      return success(`${rest.name} updated.`);
    }

    const closedOn = stage === "LOST" ? (existing?.stage === "LOST" ? existing.closedOn : todayInIST()) : null;

    if (id) {
      await prisma.lead.update({ where: { id }, data: { ...data, stage, closedOn } });
      revalidateFinance();
      return success(`${rest.name} updated.`);
    }

    const created = await prisma.lead.create({ data: { ...data, stage, closedOn } });
    revalidateFinance();
    return success(`${rest.name} added to leads.`, created.id);
  });
}

export async function setLeadStage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const id = formValue(formData, "id");
    const stage = formValue(formData, "stage");
    if (!id) return failure("Missing lead reference.");
    if (!EDITABLE_LEAD_STAGES.includes(stage as (typeof EDITABLE_LEAD_STAGES)[number])) {
      return failure("Unknown lead stage.");
    }

    const lead = await prisma.lead.findUnique({ where: { id }, select: { name: true, stage: true } });
    if (!lead) return failure("That lead no longer exists.");
    if (lead.stage === "WON") return failure(`${lead.name} is already a client.`);

    const next = stage as (typeof EDITABLE_LEAD_STAGES)[number];
    await prisma.lead.update({
      where: { id },
      data: {
        stage: next,
        closedOn: next === "LOST" ? todayInIST() : null,
        ...(next === "LOST" ? {} : { lostReason: null }),
      },
    });
    revalidateFinance();
    return success(
      next === "LOST" ? `${lead.name} closed as lost.` : `${lead.name} moved to ${next === "IN_PROCESS" ? "in process" : "just spoke"}.`,
    );
  });
}

/**
 * Closes a lead as won and makes it a client, carrying every contact detail
 * across. A client with the same company name is reused rather than
 * duplicated. Returns the client's id so the page can offer "Add project".
 */
export async function convertLead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const id = formValue(formData, "id");
    if (!id) return failure("Missing lead reference.");

    const result = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id } });
      if (!lead) return { error: "That lead no longer exists." } as const;
      if (lead.stage === "WON" && lead.clientId) {
        return { clientId: lead.clientId, name: lead.name, matched: true } as const;
      }

      const match = await tx.client.findFirst({
        where: { name: { equals: lead.name, mode: "insensitive" } },
        select: { id: true },
      });
      const clientId =
        match?.id ??
        (
          await tx.client.create({
            data: {
              name: lead.name,
              clientName: lead.clientName,
              phone: lead.phone,
              // The client form requires a point of contact; until one is named
              // it is the client themselves.
              contactPerson: lead.contactPerson ?? lead.clientName,
              contactPhone: lead.contactPhone ?? lead.phone,
              email: lead.email,
              website: lead.website,
              notes: lead.requirement ? `From lead: ${lead.requirement}` : lead.notes,
            },
            select: { id: true },
          })
        ).id;

      await tx.lead.update({
        where: { id },
        data: { stage: "WON", closedOn: todayInIST(), clientId, lostReason: null },
      });
      return { clientId, name: lead.name, matched: Boolean(match) } as const;
    });

    if ("error" in result) return failure(result.error!);

    revalidateFinance();
    return success(
      result.matched
        ? `${result.name} won — linked to the existing client. Add their project next.`
        : `${result.name} won and added to Clients. Add their project next.`,
      result.clientId,
    );
  });
}

export async function deleteLead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:delete");

    const id = formValue(formData, "id");
    if (!id) return failure("Missing lead reference.");

    const lead = await prisma.lead.findUnique({ where: { id }, select: { name: true } });
    if (!lead) return failure("That lead no longer exists.");

    // A won lead's client and projects stay exactly as they are.
    await prisma.lead.delete({ where: { id } });
    revalidateFinance();
    return success(`${lead.name} deleted from leads.`);
  });
}
