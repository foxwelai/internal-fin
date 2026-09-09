import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Money } from "@/components/finance/money";
import { EmptyState } from "@/components/finance/empty-state";
import { ScheduleStateBadge } from "@/components/finance/status-badge";
import { formatDay, formatRelativeDay } from "@/lib/dates";
import type { ScheduleRollup } from "@/lib/finance/types";

export type ScheduleListRow = {
  rollup: ScheduleRollup;
  projectId: string;
  projectName: string;
  clientName: string;
};

/**
 * The compact "what is owed" list used on Overview and in the Payments tabs.
 * Every row links to the project it belongs to.
 */
export function ScheduleList({
  rows,
  today,
  emptyTitle,
  emptyDescription,
  limit,
  showRelative = true,
}: {
  rows: ScheduleListRow[];
  today: Date;
  emptyTitle: string;
  emptyDescription?: string;
  limit?: number;
  showRelative?: boolean;
}) {
  const shown = limit ? rows.slice(0, limit) : rows;

  if (shown.length === 0) {
    return (
      <EmptyState icon={CalendarClock} title={emptyTitle} description={emptyDescription} compact />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {shown.map(({ rollup, projectId, projectName, clientName }) => (
        <li key={rollup.schedule.id}>
          <Link
            href={`/projects/${projectId}`}
            className="flex items-center gap-3 py-2.5 transition-colors hover:bg-surface-2/60"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">
                {rollup.schedule.label}
                <span className="ml-1.5 font-normal text-faint-foreground">· {projectName}</span>
              </p>
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                {clientName}
                <span className="mx-1.5 text-faint-foreground">·</span>
                <span className="font-mono tabular">{formatDay(rollup.schedule.dueDate)}</span>
                {showRelative && rollup.outstandingPaise > 0n ? (
                  <span
                    className={cn(
                      "ml-1.5",
                      rollup.state === "OVERDUE" ? "text-negative" : "text-faint-foreground",
                    )}
                  >
                    {formatRelativeDay(rollup.schedule.dueDate, today)}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Money value={rollup.outstandingPaise} className="text-[13px] font-medium" />
              <ScheduleStateBadge state={rollup.state} daysOverdue={rollup.daysOverdue} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
