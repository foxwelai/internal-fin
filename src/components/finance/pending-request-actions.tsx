"use client";

import * as React from "react";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApproveDialog } from "@/components/dialogs/user-dialog";
import { ConfirmAction } from "@/components/finance/confirm-action";
import { declineUser, deleteUser, setUserActive } from "@/app/actions/users";

export function PendingRequestActions({
  userId,
  name,
  email,
}: {
  userId: string;
  name: string;
  email: string;
}) {
  const [confirmDecline, setConfirmDecline] = React.useState(false);

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button variant="ghost" size="sm" onClick={() => setConfirmDecline(true)}>
        <X />
        Decline
      </Button>
      <ApproveDialog userId={userId} name={name} email={email}>
        <Button size="sm">
          <Check />
          Approve
        </Button>
      </ApproveDialog>

      <ConfirmAction
        open={confirmDecline}
        onOpenChange={setConfirmDecline}
        action={declineUser}
        hidden={{ id: userId }}
        title={`Decline ${name}?`}
        description="They stay signed in to Clerk but see no data, and are told their request was declined. You can reconsider later from Declined requests."
        confirmLabel="Decline"
      />
    </div>
  );
}

/** A declined request can be reconsidered, or forgotten entirely. */
export function DeclinedRequestActions({ userId, name }: { userId: string; name: string }) {
  const [confirm, setConfirm] = React.useState<null | "reopen" | "remove">(null);

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button variant="ghost" size="sm" onClick={() => setConfirm("remove")}>
        Remove
      </Button>
      <Button variant="outline" size="sm" onClick={() => setConfirm("reopen")}>
        Reconsider
      </Button>

      <ConfirmAction
        open={confirm === "reopen"}
        onOpenChange={(next) => setConfirm(next ? "reopen" : null)}
        action={setUserActive}
        hidden={{ id: userId, active: "true" }}
        title={`Reconsider ${name}?`}
        description="Their request goes back to Pending, where you can approve it with a role."
        confirmLabel="Move to pending"
      />
      <ConfirmAction
        open={confirm === "remove"}
        onOpenChange={(next) => setConfirm(next ? "remove" : null)}
        action={deleteUser}
        hidden={{ id: userId }}
        title={`Remove ${name}'s request?`}
        description="The record is deleted. If they sign in again, a fresh request appears."
        confirmLabel="Remove"
      />
    </div>
  );
}
