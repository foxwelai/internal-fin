"use server";

import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createReviewToken, hashReviewToken, REVIEW_LINK_DAYS } from "@/lib/review-link";

import {
  failure,
  formValue,
  revalidateFinance,
  runAction,
  success,
  type ActionState,
} from "./helpers";

/**
 * Creates a fresh review link for a project's client or point of contact.
 * Every call makes a new link — the raw token is returned once, in
 * `createdId`, and never stored.
 */
export async function createReviewLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermission("finance:write");

    const projectId = formValue(formData, "projectId");
    const recipient = formValue(formData, "recipient");
    if (!projectId) return failure("Missing project reference.");
    if (recipient !== "CLIENT" && recipient !== "POINT_OF_CONTACT") {
      return failure("Choose who the link is for.");
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, client: true },
    });
    if (!project) return failure("That project no longer exists.");

    const { client } = project;
    const recipientName =
      (recipient === "CLIENT" ? client.clientName : client.contactPerson) ?? client.name;
    const recipientPhone = recipient === "CLIENT" ? client.phone : client.contactPhone;

    const token = createReviewToken();
    await prisma.clientReview.create({
      data: {
        projectId,
        tokenHash: hashReviewToken(token),
        recipient,
        recipientName,
        recipientPhone,
        requestedById: actor.id,
        expiresAt: new Date(Date.now() + REVIEW_LINK_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    revalidateFinance();
    return success(`Review link ready for ${recipientName}.`, token);
  });
}

export async function revokeReviewLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const id = formValue(formData, "id");
    if (!id) return failure("Missing review reference.");

    const { count } = await prisma.clientReview.updateMany({
      where: { id, submittedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    revalidateFinance();
    return count > 0
      ? success("Link cancelled. It no longer opens the review form.")
      : failure("That link was already used or cancelled.");
  });
}

export async function deleteClientReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:delete");

    const id = formValue(formData, "id");
    if (!id) return failure("Missing review reference.");

    const { count } = await prisma.clientReview.deleteMany({ where: { id } });
    revalidateFinance();
    return count > 0 ? success("Review deleted.") : failure("That review no longer exists.");
  });
}
