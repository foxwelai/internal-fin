"use client";

import * as React from "react";
import { CalendarClock, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScheduleDialog, type ScheduleInitial } from "@/components/dialogs/schedule-dialog";
import { RescheduleDialog } from "@/components/dialogs/reschedule-dialog";
import { ConfirmAction } from "@/components/finance/confirm-action";
import { deleteSchedule } from "@/app/actions/schedules";

export function ScheduleRowActions({
  schedule,
  projectId,
  projectName,
  availablePaise,
  allocatedPaise,
  today,
}: {
  schedule: ScheduleInitial;
  projectId: string;
  projectName: string;
  availablePaise: number;
  allocatedPaise: number;
  today: string;
}) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const editTrigger = React.useRef<HTMLButtonElement>(null);
  const moveTrigger = React.useRef<HTMLButtonElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${schedule.label}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setTimeout(() => moveTrigger.current?.click(), 0)}>
            <CalendarClock />
            Reschedule
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTimeout(() => editTrigger.current?.click(), 0)}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setTimeout(() => setConfirmDelete(true), 0)}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ScheduleDialog
        projectId={projectId}
        projectName={projectName}
        availablePaise={availablePaise}
        initial={schedule}
        today={today}
      >
        <button type="button" ref={editTrigger} className="sr-only" aria-hidden tabIndex={-1} />
      </ScheduleDialog>

      <RescheduleDialog
        scheduleId={schedule.id}
        label={schedule.label}
        defaultDate={schedule.dueDate}
      >
        <button type="button" ref={moveTrigger} className="sr-only" aria-hidden tabIndex={-1} />
      </RescheduleDialog>

      <ConfirmAction
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        action={deleteSchedule}
        hidden={{ id: schedule.id }}
        title={`Delete "${schedule.label}"?`}
        description={
          allocatedPaise > 0
            ? "Money received has been matched to this milestone, so deletion will be refused. Unallocate that receipt first, or edit the amount instead."
            : "This removes the expectation from the schedule. Money already received is untouched."
        }
        confirmLabel="Delete"
      />
    </>
  );
}
