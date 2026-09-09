import { describe, expect, it } from "vitest";

import { can, PERMISSIONS, permissionsFor, ROLE_ORDER } from "./permissions";

describe("permissions", () => {
  it("gives an owner everything", () => {
    for (const permission of PERMISSIONS) expect(can("OWNER", permission)).toBe(true);
  });

  it("lets an admin run the books but not the people", () => {
    expect(can("ADMIN", "finance:read")).toBe(true);
    expect(can("ADMIN", "finance:write")).toBe(true);
    expect(can("ADMIN", "finance:delete")).toBe(true);
    expect(can("ADMIN", "users:manage")).toBe(false);
    expect(can("ADMIN", "settings:manage")).toBe(false);
  });

  it("lets a viewer only look", () => {
    expect(can("VIEWER", "finance:read")).toBe(true);
    for (const permission of PERMISSIONS.filter((p) => p !== "finance:read")) {
      expect(can("VIEWER", permission)).toBe(false);
    }
  });

  it("never grants a lower role something a higher one lacks", () => {
    for (let i = 1; i < ROLE_ORDER.length; i += 1) {
      const higher = permissionsFor(ROLE_ORDER[i - 1]);
      const lower = permissionsFor(ROLE_ORDER[i]);
      for (const permission of lower) expect(higher).toContain(permission);
    }
  });

  it("only managing users can manage users", () => {
    const allowed = ROLE_ORDER.filter((role) => can(role, "users:manage"));
    expect(allowed).toEqual(["OWNER"]);
  });
});
