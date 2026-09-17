import { describe, expect, it } from "vitest";

import { accessStateOf, decideLink, type ClerkIdentity, type KnownUser } from "./access";

const approved = new Date("2026-09-01T00:00:00Z");

const identity = (overrides: Partial<ClerkIdentity> = {}): ClerkIdentity => ({
  clerkUserId: "user_clerk_1",
  email: "work@foxwel.ai",
  emailVerified: true,
  name: "Work",
  ...overrides,
});

const known = (overrides: Partial<KnownUser> = {}): KnownUser => ({
  id: "row-1",
  clerkUserId: null,
  email: "work@foxwel.ai",
  role: "SUPER_ADMIN",
  approvedAt: approved,
  isActive: true,
  ...overrides,
});

describe("access state", () => {
  it("opens the app only for someone approved and active", () => {
    expect(accessStateOf({ approvedAt: approved, isActive: true })).toBe("approved");
  });

  it("holds a new sign-up as pending until a super admin decides", () => {
    expect(accessStateOf({ approvedAt: null, isActive: true })).toBe("pending");
  });

  it("distinguishes a declined request from a revoked account", () => {
    expect(accessStateOf({ approvedAt: null, isActive: false })).toBe("declined");
    expect(accessStateOf({ approvedAt: approved, isActive: false })).toBe("deactivated");
  });
});

describe("linking a Clerk sign-in to an account", () => {
  it("uses an existing link first", () => {
    const row = known({ clerkUserId: "user_clerk_1" });
    expect(decideLink(identity(), row, row)).toEqual({ kind: "linked", userId: "row-1" });
  });

  it("lets a verified email claim the matching account", () => {
    expect(decideLink(identity(), null, known())).toEqual({ kind: "claim", userId: "row-1" });
  });

  it("never lets an unverified email claim an account — not even the super admin's", () => {
    expect(decideLink(identity({ emailVerified: false }), null, known())).toEqual({
      kind: "refuse",
      reason: "unverified-email",
    });
  });

  it("refuses to re-point an account already tied to a different Clerk user", () => {
    const row = known({ clerkUserId: "user_someone_else" });
    expect(decideLink(identity(), null, row)).toEqual({
      kind: "refuse",
      reason: "email-owned-by-another-account",
    });
  });

  it("records an unknown person as a request, granting nothing", () => {
    expect(
      decideLink(identity({ email: "stranger@example.com", name: "Stranger" }), null, null),
    ).toEqual({ kind: "request", email: "stranger@example.com", name: "Stranger" });
  });

  it("refuses an identity with no email to match on", () => {
    expect(decideLink(identity({ email: null }), null, null)).toEqual({
      kind: "refuse",
      reason: "no-email",
    });
  });
});
