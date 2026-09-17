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
import { UserDialog, type UserInitial } from "@/components/dialogs/user-dialog";
import { ConfirmAction } from "@/components/finance/confirm-action";
import { deleteUser, setUserActive } from "@/app/actions/users";
import { ROLE_LABELS } from "@/lib/permissions";

export function UserRowActions({
  user,
  isActive,
  isSelf,
  isLastSuperAdmin,
}: {
  user: UserInitial;
  isActive: boolean;
  isSelf: boolean;
  isLastSuperAdmin: boolean;
}) {
  const [confirm, setConfirm] = React.useState<null | "active" | "delete">(null);
  const editTrigger = React.useRef<HTMLButtonElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${user.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => setTimeout(() => editTrigger.current?.click(), 0)}>
            <Pencil />
            Edit name & role
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isSelf || (isActive && isLastSuperAdmin)}
            onSelect={() => setTimeout(() => setConfirm("active"), 0)}
          >
            {isActive ? <UserX /> : <UserCheck />}
            {isActive ? "Deactivate" : "Reactivate"}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={isSelf || isLastSuperAdmin}
            onSelect={() => setTimeout(() => setConfirm("delete"), 0)}
          >
            <Trash2 />
            Delete account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <UserDialog initial={user}>
        <button type="button" ref={editTrigger} className="sr-only" aria-hidden tabIndex={-1} />
      </UserDialog>

      <ConfirmAction
        open={confirm === "active"}
        onOpenChange={(next) => setConfirm(next ? "active" : null)}
        action={setUserActive}
        hidden={{ id: user.id, active: isActive ? "false" : "true" }}
        title={isActive ? `Deactivate ${user.name}?` : `Reactivate ${user.name}?`}
        description={
          isActive
            ? "They lose access on their next request, even if they are signed in right now. Their Clerk sign-in still works, but it shows them no data. You can turn access back on at any time."
            : `They will be able to sign in again as ${ROLE_LABELS[user.role]}.`
        }
        confirmLabel={isActive ? "Deactivate" : "Reactivate"}
      />

      <ConfirmAction
        open={confirm === "delete"}
        onOpenChange={(next) => setConfirm(next ? "delete" : null)}
        action={deleteUser}
        hidden={{ id: user.id }}
        title={`Delete ${user.name}'s account?`}
        description="This removes their access record. Their Clerk sign-in is untouched, so if they sign in again they reappear as a pending request. To simply block them, deactivate instead."
        confirmLabel="Delete permanently"
      />
    </>
  );
}
