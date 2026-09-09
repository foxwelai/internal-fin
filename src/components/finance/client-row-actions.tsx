"use client";

import * as React from "react";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClientDialog, type ClientInitial } from "@/components/dialogs/client-dialog";
import { ConfirmAction } from "@/components/finance/confirm-action";
import { deleteClient, setClientArchived } from "@/app/actions/clients";

export function ClientRowActions({
  client,
  archived,
  projectCount,
}: {
  client: ClientInitial;
  archived: boolean;
  projectCount: number;
}) {
  const [confirm, setConfirm] = React.useState<null | "archive" | "delete">(null);
  const editTrigger = React.useRef<HTMLButtonElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${client.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setTimeout(() => editTrigger.current?.click(), 0)}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTimeout(() => setConfirm("archive"), 0)}>
            {archived ? <ArchiveRestore /> : <Archive />}
            {archived ? "Restore" : "Archive"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setTimeout(() => setConfirm("delete"), 0)}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ClientDialog initial={client}>
        <button type="button" ref={editTrigger} className="sr-only" aria-hidden tabIndex={-1} />
      </ClientDialog>

      <ConfirmAction
        open={confirm === "archive"}
        onOpenChange={(open) => setConfirm(open ? "archive" : null)}
        action={setClientArchived}
        hidden={{ id: client.id, archive: archived ? "false" : "true" }}
        title={archived ? `Restore ${client.name}?` : `Archive ${client.name}?`}
        description={
          archived
            ? "They will appear in the active list again. Nothing else changes."
            : "They move out of the active list. Projects, payment schedules and every receipt are kept exactly as they are, and you can restore them at any time."
        }
        confirmLabel={archived ? "Restore" : "Archive"}
      />

      <ConfirmAction
        open={confirm === "delete"}
        onOpenChange={(open) => setConfirm(open ? "delete" : null)}
        action={deleteClient}
        hidden={{ id: client.id }}
        title={`Delete ${client.name}?`}
        description={
          projectCount > 0
            ? `This client has ${projectCount} project${projectCount === 1 ? "" : "s"}. Deletion will be refused so their payment history is not lost — archive them instead.`
            : "This permanently removes the client record. It cannot be undone."
        }
        confirmLabel="Delete permanently"
      />
    </>
  );
}
