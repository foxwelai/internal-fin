"use client";

import * as React from "react";

import type { Permission } from "@/lib/permissions";
import type { UserRole } from "@/generated/prisma";

export type ViewerIdentity = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: readonly Permission[];
};

const ViewerContext = React.createContext<ViewerIdentity | null>(null);

/**
 * Makes the signed-in account's permissions available to client components so
 * the interface can hide controls the account cannot use.
 *
 * This is presentation only. Every action re-checks on the server against the
 * role read fresh from the database, because hiding a button stops nobody who
 * can send an HTTP request.
 */
export function PermissionProvider({
  viewer,
  children,
}: {
  viewer: ViewerIdentity;
  children: React.ReactNode;
}) {
  // The object identity changes only when the role does.
  const value = React.useMemo(() => viewer, [viewer]);
  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewer(): ViewerIdentity {
  const viewer = React.useContext(ViewerContext);
  if (!viewer) throw new Error("useViewer must be used inside PermissionProvider");
  return viewer;
}

export function useCan(permission: Permission): boolean {
  return useViewer().permissions.includes(permission);
}

/** Renders `children` only when the viewer holds `permission`. */
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return useCan(permission) ? <>{children}</> : <>{fallback}</>;
}
