"use client";

import * as React from "react";
import {
  Archive,
  ArchiveRestore,
  CalendarPlus,
  CircleCheck,
  CirclePause,
  Clock,
  MoreHorizontal,
  Pencil,
  Trash2,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectDialog, type ProjectInitial } from "@/components/dialogs/project-dialog";
import { ScheduleDialog } from "@/components/dialogs/schedule-dialog";
import { ReceiptDialog } from "@/components/dialogs/receipt-dialog";
import { ConfirmAction, InlineAction } from "@/components/finance/confirm-action";
import { deleteProject, setProjectArchived, setProjectStatus } from "@/app/actions/projects";
import type { ClientOption, ProjectOption } from "@/components/finance/options";
import type { ProjectStatus } from "@/lib/finance/types";
import { PROJECT_STATUS_LABELS } from "@/lib/finance/labels";

const STATUS_ICON = {
  APPROVED: CircleCheck,
  PENDING: Clock,
  ON_HOLD: CirclePause,
} as const;

export function ProjectRowActions({
  project,
  option,
  clients,
  initial,
  archived,
  receiptCount,
  today,
}: {
  project: { id: string; name: string; status: ProjectStatus };
  option: ProjectOption;
  clients: ClientOption[];
  initial: ProjectInitial;
  archived: boolean;
  receiptCount: number;
  today: string;
}) {
  const [confirm, setConfirm] = React.useState<null | "archive" | "delete">(null);
  const editTrigger = React.useRef<HTMLButtonElement>(null);
  const scheduleTrigger = React.useRef<HTMLButtonElement>(null);
  const receiptTrigger = React.useRef<HTMLButtonElement>(null);

  const otherStatuses = (["APPROVED", "PENDING", "ON_HOLD"] as ProjectStatus[]).filter(
    (status) => status !== project.status,
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${project.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => setTimeout(() => receiptTrigger.current?.click(), 0)}>
            <Wallet />
            Record payment
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTimeout(() => scheduleTrigger.current?.click(), 0)}>
            <CalendarPlus />
            Add scheduled payment
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTimeout(() => editTrigger.current?.click(), 0)}>
            <Pencil />
            Edit project
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Move to</DropdownMenuLabel>
          {otherStatuses.map((status) => {
            const Icon = STATUS_ICON[status];
            return (
              <DropdownMenuItem key={status} asChild>
                <div>
                  <InlineAction action={setProjectStatus} hidden={{ id: project.id, status }}>
                    <Icon className="size-4 text-faint-foreground" />
                    {PROJECT_STATUS_LABELS[status]}
                  </InlineAction>
                </div>
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setTimeout(() => setConfirm("archive"), 0)}>
            {archived ? <ArchiveRestore /> : <Archive />}
            {archived ? "Restore" : "Archive"}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setTimeout(() => setConfirm("delete"), 0)}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProjectDialog clients={clients} initial={initial}>
        <button type="button" ref={editTrigger} className="sr-only" aria-hidden tabIndex={-1} />
      </ProjectDialog>

      <ScheduleDialog
        projectId={project.id}
        projectName={project.name}
        availablePaise={option.unscheduledPaise}
        today={today}
      >
        <button type="button" ref={scheduleTrigger} className="sr-only" aria-hidden tabIndex={-1} />
      </ScheduleDialog>

      <ReceiptDialog projects={[option]} defaultProjectId={project.id} today={today}>
        <button type="button" ref={receiptTrigger} className="sr-only" aria-hidden tabIndex={-1} />
      </ReceiptDialog>

      <ConfirmAction
        open={confirm === "archive"}
        onOpenChange={(open) => setConfirm(open ? "archive" : null)}
        action={setProjectArchived}
        hidden={{ id: project.id, archive: archived ? "false" : "true" }}
        title={archived ? `Restore ${project.name}?` : `Archive ${project.name}?`}
        description={
          archived
            ? "The project returns to the active list with its schedule and receipts intact."
            : "It leaves the active list and stops contributing to forecasts. Receipts already recorded stay in the collections history for the months they landed in."
        }
        confirmLabel={archived ? "Restore" : "Archive"}
      />

      <ConfirmAction
        open={confirm === "delete"}
        onOpenChange={(open) => setConfirm(open ? "delete" : null)}
        action={deleteProject}
        hidden={{ id: project.id }}
        title={`Delete ${project.name}?`}
        description={
          receiptCount > 0
            ? `This project has ${receiptCount} recorded receipt${receiptCount === 1 ? "" : "s"}. Deletion will be refused so the collection history survives — archive it instead.`
            : "This permanently removes the project and its payment schedule. It cannot be undone."
        }
        confirmLabel="Delete permanently"
      />
    </>
  );
}
