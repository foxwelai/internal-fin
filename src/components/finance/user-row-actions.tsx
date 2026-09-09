"use client";

import * as React from "react";
import { KeyRound, MoreHorizontal, Pencil, Trash2, UserCheck, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ResetPasswordDialog, UserDialog, type UserInitial } from "@/components/dialogs/user-dialog";
import { ConfirmAction } from "@/components/finance/confirm-action";
import { deleteUser, setUserActive } from "@/app/actions/users";
import { ROLE_LABELS } from "@/lib/permissions";

export function UserRowActions({
  user,
  isActive,
  isSelf,
  isLastActiveOwner,
}: {
  user: UserInitial;
  isActive: boolean;
  isSelf: boolean;
  isLastActiveOwner: boolean;
}) {
  const [confirm, setConfirm] = React.useState<null | "active" | "delete">(null);
  const editTrigger = React.useRef<HTMLButtonElement>(null);
  const resetTrigger = React.useRef<HTMLButtonElement>(null);

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
          <DropdownMenuItem onSelect={() => setTimeout(() => resetTrigger.current?.click(), 0)}>
            <KeyRound />
            Reset password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isSelf || (isActive && isLastActiveOwner)}
            onSelect={() => setTimeout(() => setConfirm("active"), 0)}
          >
            {isActive ? <UserX /> : <UserCheck />}
            {isActive ? "Deactivate" : "Reactivate"}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={isSelf || isLastActiveOwner}
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

      <ResetPasswordDialog userId={user.id} userName={user.name}>
        <button type="button" ref={resetTrigger} className="sr-only" aria-hidden tabIndex={-1} />
      </ResetPasswordDialog>

      <ConfirmAction
        open={confirm === "active"}
        onOpenChange={(next) => setConfirm(next ? "active" : null)}
        action={setUserActive}
        hidden={{ id: user.id, active: isActive ? "false" : "true" }}
        title={isActive ? `Deactivate ${user.name}?` : `Reactivate ${user.name}?`}
        description={
          isActive
            ? "They lose access on their next request, even if they are signed in right now. The account and everything they recorded are kept, so you can turn it back on at any time."
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
        description="This removes the account permanently and cannot be undone. If you only want to revoke access, deactivate instead — that keeps the record of who added what."
        confirmLabel="Delete permanently"
      />
    </>
  );
}
