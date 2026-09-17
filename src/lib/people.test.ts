import { describe, expect, it } from "vitest";

import { mergePeople, type AccessRecord, type ClerkPerson } from "./people";

const at = (iso: string) => new Date(iso);

const clerk = (overrides: Partial<ClerkPerson> & { clerkUserId: string }): ClerkPerson => ({
  email: `${overrides.clerkUserId}@example.com`,
  emailVerified: true,
  name: overrides.clerkUserId,
  imageUrl: null,
  signedUpAt: at("2026-09-10T00:00:00Z"),
  lastSignInAt: null,
  ...overrides,
});

const record = (overrides: Partial<AccessRecord> & { id: string; email: string }): AccessRecord => ({
  clerkUserId: null,
  name: overrides.id,
  role: "VIEWER",
  approvedAt: at("2026-09-01T00:00:00Z"),
  isActive: true,
  createdAt: at("2026-09-01T00:00:00Z"),
  ...overrides,
});

describe("people list", () => {
  it("shows someone who signed up but never opened the app", () => {
    const [person] = mergePeople([clerk({ clerkUserId: "u_new", email: "new@example.com" })], []);
    expect(person).toMatchObject({ state: "needs-access", access: "NONE", userId: null });
  });

  it("shows an approved member with their role", () => {
    const [person] = mergePeople(
      [clerk({ clerkUserId: "u_1", email: "work@foxwel.ai" })],
      [record({ id: "r1", email: "work@foxwel.ai", clerkUserId: "u_1", role: "SUPER_ADMIN" })],
    );
    expect(person).toMatchObject({ state: "approved", access: "SUPER_ADMIN", userId: "r1" });
  });

  it("matches a pre-approved email to the person who signed up with it", () => {
    const people = mergePeople(
      [clerk({ clerkUserId: "u_2", email: "ananya@foxwel.ai" })],
      [record({ id: "r2", email: "ananya@foxwel.ai", role: "ADMIN" })],
    );
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({ state: "approved", access: "ADMIN", userId: "r2" });
  });

  it("does not match a pre-approved email to an unverified sign-up", () => {
    const people = mergePeople(
      [clerk({ clerkUserId: "u_3", email: "ananya@foxwel.ai", emailVerified: false })],
      [record({ id: "r3", email: "ananya@foxwel.ai", role: "ADMIN" })],
    );
    expect(people).toHaveLength(2);
    expect(people.find((p) => p.clerkUserId === "u_3")).toMatchObject({ access: "NONE" });
    expect(people.find((p) => p.userId === "r3")).toMatchObject({ state: "invited" });
  });

  it("marks an approval nobody has used yet as invited", () => {
    const [person] = mergePeople([], [record({ id: "r4", email: "later@foxwel.ai", role: "ADMIN" })]);
    expect(person).toMatchObject({ state: "invited", access: "ADMIN" });
  });

  it("reports declined and deactivated people as having no access", () => {
    const people = mergePeople(
      [clerk({ clerkUserId: "u_5" }), clerk({ clerkUserId: "u_6" })],
      [
        record({ id: "r5", email: "u_5@example.com", clerkUserId: "u_5", approvedAt: null, isActive: false }),
        record({ id: "r6", email: "u_6@example.com", clerkUserId: "u_6", isActive: false, role: "ADMIN" }),
      ],
    );
    expect(people.map((p) => [p.state, p.access])).toEqual([
      ["no-access", "NONE"],
      ["no-access", "NONE"],
    ]);
  });

  it("puts people waiting for a decision first", () => {
    const people = mergePeople(
      [
        clerk({ clerkUserId: "u_member" }),
        clerk({ clerkUserId: "u_waiting", signedUpAt: at("2026-09-15T00:00:00Z") }),
      ],
      [record({ id: "rm", email: "u_member@example.com", clerkUserId: "u_member" })],
    );
    expect(people[0].clerkUserId).toBe("u_waiting");
  });
});
