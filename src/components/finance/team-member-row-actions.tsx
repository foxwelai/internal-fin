"use client";

import * as React from "react";
import { MoreHorizontal, Pencil, Trash2, UserCheck, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TeamMemberDialog, type TeamMemberInitial } from "@/components/dialogs/team-member-dialog";
import { ConfirmAction, InlineAction } from "@/components/finance/confirm-action";
import { deleteTeamMember, setTeamMemberActive } from "@/app/actions/team";

export function TeamMemberRowActions({
  member,
  active,
  projectCount,
  canDelete,
}: {
  member: TeamMemberInitial;
  active: boolean;
  projectCount: number;
  canDelete: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const editTrigger = React.useRef<HTMLButtonElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${member.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setTimeout(() => editTrigger.current?.click(), 0)}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <div>
              <InlineAction
                action={setTeamMemberActive}
                hidden={{ id: member.id, active: active ? "false" : "true" }}
              >
                {active ? (
                  <UserX className="size-4 text-faint-foreground" />
                ) : (
                  <UserCheck className="size-4 text-faint-foreground" />
                )}
                {active ? "Mark as left" : "Back on the team"}
              </InlineAction>
            </div>
          </DropdownMenuItem>
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setTimeout(() => setConfirmDelete(true), 0)}
              >
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <TeamMemberDialog initial={member}>
        <button type="button" ref={editTrigger} className="sr-only" aria-hidden tabIndex={-1} />
      </TeamMemberDialog>

      <ConfirmAction
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        action={deleteTeamMember}
        hidden={{ id: member.id }}
        title={`Remove ${member.name}?`}
        description={
          projectCount > 0
            ? `${member.name} coordinates ${projectCount} project${projectCount === 1 ? "" : "s"}, so this will be refused — mark them as left instead.`
            : "They are removed from the team list. This cannot be undone."
        }
        confirmLabel="Remove"
      />
    </>
  );
}
