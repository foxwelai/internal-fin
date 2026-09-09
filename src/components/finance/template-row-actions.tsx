"use client";

import * as React from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TemplateDialog, type TemplateInitial } from "@/components/dialogs/template-dialog";
import { ConfirmAction } from "@/components/finance/confirm-action";
import { deleteTemplate } from "@/app/actions/expenses";

export function TemplateRowActions({
  template,
  generatedCount,
}: {
  template: TemplateInitial;
  generatedCount: number;
}) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const editTrigger = React.useRef<HTMLButtonElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${template.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
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

      <TemplateDialog initial={template}>
        <button type="button" ref={editTrigger} className="sr-only" aria-hidden tabIndex={-1} />
      </TemplateDialog>

      <ConfirmAction
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        action={deleteTemplate}
        hidden={{ id: template.id }}
        title={`Delete the ${template.name} template?`}
        description={
          generatedCount > 0
            ? `The ${generatedCount} expense line${generatedCount === 1 ? "" : "s"} already generated from it are kept — only the blueprint for future months is removed.`
            : "The blueprint is removed. Future months will no longer generate this cost."
        }
        confirmLabel="Delete template"
      />
    </>
  );
}
