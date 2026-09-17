import { describe, expect, it } from "vitest";

import { whatsappNumber } from "./phone";
import { createReviewToken, hashReviewToken, isWellFormedReviewToken } from "./review-link";

describe("review links", () => {
  it("makes unguessable, URL-safe tokens and stores only a hash", () => {
    const a = createReviewToken();
    const b = createReviewToken();
    expect(a).not.toBe(b);
    expect(isWellFormedReviewToken(a)).toBe(true);
    expect(hashReviewToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashReviewToken(a)).toBe(hashReviewToken(a));
    expect(hashReviewToken(a)).not.toContain(a);
  });

  it("rejects malformed tokens before touching the database", () => {
    expect(isWellFormedReviewToken("")).toBe(false);
    expect(isWellFormedReviewToken("../../etc")).toBe(false);
    expect(isWellFormedReviewToken("a".repeat(44))).toBe(false);
  });

  it("turns Indian phone numbers into WhatsApp numbers", () => {
    expect(whatsappNumber("+91 98200 41122")).toBe("919820041122");
    expect(whatsappNumber("98200 41122")).toBe("919820041122");
    expect(whatsappNumber("098200-41122")).toBe("919820041122");
    expect(whatsappNumber("+1 (415) 555-0100")).toBe("14155550100");
    expect(whatsappNumber("12345")).toBeNull();
    expect(whatsappNumber(null)).toBeNull();
  });
});
