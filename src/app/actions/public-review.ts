"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { hashReviewToken, isWellFormedReviewToken } from "@/lib/review-link";
import { checkboxField, optionalText, requiredText } from "@/lib/validation/common";

import { failure, formValue, fromZodError, runAction, success, type ActionState } from "./helpers";

/**
 * The one action a signed-out visitor may call: a client submitting the review
 * they were sent a link for. Authorisation is the link itself — a random token
 * whose hash must match an open, unexpired request. It can write only the
 * review fields of that one request, and only once.
 */

const reviewSchema = z.object({
  token: z.string(),
  rating: z.coerce
    .number({ error: "Choose a rating" })
    .int()
    .min(1, "Choose a rating from 1 to 5")
    .max(5, "Choose a rating from 1 to 5"),
  whatWentWell: optionalText(2000),
  couldImprove: optionalText(2000),
  reviewerName: requiredText("Your name", 120),
  canQuote: checkboxField,
});

export async function submitClientReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const parsed = reviewSchema.safeParse({
      token: formValue(formData, "token"),
      rating: formValue(formData, "rating") || undefined,
      whatWentWell: formValue(formData, "whatWentWell"),
      couldImprove: formValue(formData, "couldImprove"),
      reviewerName: formValue(formData, "reviewerName"),
      canQuote: formData.get("canQuote"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const { token, ...answers } = parsed.data;
    const closed = "This review link has expired or was already used.";
    if (!isWellFormedReviewToken(token)) return failure(closed);

    // Conditional update: two submissions racing on one link cannot both land.
    const request = await prisma.clientReview.findUnique({
      where: { tokenHash: hashReviewToken(token) },
      select: { id: true, projectId: true },
    });
    if (!request) return failure(closed);

    const { count } = await prisma.clientReview.updateMany({
      where: {
        id: request.id,
        submittedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { ...answers, submittedAt: new Date() },
    });
    if (count === 0) return failure(closed);

    revalidatePath(`/projects/${request.projectId}`);
    return success("Thank you — your review has been sent to the Foxwel team.");
  });
}
