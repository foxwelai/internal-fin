"use client";

import { Eye } from "lucide-react";

import { useViewer } from "@/components/auth/permission-provider";
import { ROLE_LABELS } from "@/lib/permissions";

/**
 * Tells a read-only account why it sees no buttons, rather than leaving them
 * to wonder whether the page is broken.
 */
export function ReadOnlyBanner() {
  const viewer = useViewer();
  if (viewer.permissions.includes("finance:write")) return null;

  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-border bg-surface-2 px-3.5 py-2.5">
      <Eye className="mt-px size-4 shrink-0 text-faint-foreground" />
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        You are signed in as a <span className="text-foreground">{ROLE_LABELS[viewer.role]}</span>,
        so everything here is read-only. Ask an owner if you need to record or edit anything.
      </p>
    </div>
  );
}
