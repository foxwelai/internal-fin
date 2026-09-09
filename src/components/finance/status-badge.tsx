import { Badge } from "@/components/ui/badge";
import {
  PROJECT_STATUS_LABELS,
  SCHEDULE_STATE_LABELS,
} from "@/lib/finance/labels";
import type { ProjectStatus, ScheduleState } from "@/lib/finance/types";

const PROJECT_VARIANT = {
  APPROVED: "positive",
  PENDING: "warning",
  ON_HOLD: "default",
} as const;

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge variant={PROJECT_VARIANT[status]}>{PROJECT_STATUS_LABELS[status]}</Badge>;
}

const SCHEDULE_VARIANT = {
  PAID: "positive",
  PARTIALLY_PAID: "info",
  OVERDUE: "negative",
  UNPAID: "outline",
} as const;

export function ScheduleStateBadge({
  state,
  daysOverdue = 0,
}: {
  state: ScheduleState | "PAID" | "PARTIALLY_PAID" | "OVERDUE" | "UNPAID";
  daysOverdue?: number;
}) {
  return (
    <Badge variant={SCHEDULE_VARIANT[state]}>
      {SCHEDULE_STATE_LABELS[state]}
      {state === "OVERDUE" && daysOverdue > 0 ? (
        <span className="font-mono tabular opacity-80">{daysOverdue}d</span>
      ) : null}
    </Badge>
  );
}
