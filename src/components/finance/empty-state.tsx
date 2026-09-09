import * as React from "react";

import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border text-center",
        compact ? "gap-1.5 px-4 py-7" : "gap-2.5 px-6 py-12",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-1 flex size-9 items-center justify-center rounded-lg border border-border bg-surface-2">
          <Icon className="size-4 text-faint-foreground" />
        </div>
      ) : null}
      <p className={cn("font-medium text-foreground", compact ? "text-[13px]" : "text-sm")}>{title}</p>
      {description ? (
        <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
