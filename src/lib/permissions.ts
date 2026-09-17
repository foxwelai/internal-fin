import type { UserRole } from "@/generated/prisma";

/**
 * What each role may do.
 *
 * Who holds which role is data — it lives in the `users` table and is changed
 * from the Team page, never from a deploy. What a role *means* is policy, and
 * policy belongs in reviewed, tested code rather than in a table nobody audits:
 * a bug that silently widens access is far worse than one that needs a deploy
 * to fix.
 *
 * Every check runs on the server against the role read fresh from the database
 * on that request, so a demotion takes effect on the user's very next action.
 */

export const PERMISSIONS = [
  "finance:read",
  "finance:write",
  "finance:delete",
  "settings:manage",
  "users:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  SUPER_ADMIN: ["finance:read", "finance:write", "finance:delete", "settings:manage", "users:manage"],
  ADMIN: ["finance:read", "finance:write", "finance:delete"],
  VIEWER: ["finance:read"],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  VIEWER: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  SUPER_ADMIN:
    "Root access: everything, including approving people, changing roles and company settings.",
  ADMIN: "Can record and edit everything financial. Cannot manage people or company settings.",
  VIEWER: "Can see every figure but change nothing.",
};

/** Ordered most to least privileged — used for sorting and for select menus. */
export const ROLE_ORDER: UserRole[] = ["SUPER_ADMIN", "ADMIN", "VIEWER"];

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsFor(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

/** Message shown when an action is refused, naming what the role lacks. */
export function forbiddenMessage(role: UserRole, permission: Permission): string {
  const what: Record<Permission, string> = {
    "finance:read": "view financial records",
    "finance:write": "record or edit financial data",
    "finance:delete": "delete records",
    "settings:manage": "change company settings",
    "users:manage": "manage people",
  };
  return `Your account is a ${ROLE_LABELS[role]}, which cannot ${what[permission]}. Ask a super admin if you need this.`;
}
