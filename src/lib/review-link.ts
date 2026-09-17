import { createHash, randomBytes } from "node:crypto";

/**
 * Review links. The token in the URL is 256 random bits; the database keeps
 * only its SHA-256, so someone reading the table still can't submit a review.
 */

export const REVIEW_LINK_DAYS = 30;

export function createReviewToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashReviewToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Rejects anything that could not have come from `createReviewToken`. */
export function isWellFormedReviewToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
