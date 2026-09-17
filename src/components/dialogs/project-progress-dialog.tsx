"use client";

import * as React from "react";
import { CheckCheck, Loader2 } from "lucide-react";

import { markProjectCompleted, updateProjectProgress } from "@/app/actions/projects";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormAlert, SubmitButton } from "@/components/finance/form-kit";
import { ProgressFields } from "@/components/finance/progress-fields";
import { useActionDialog, useActionForm } from "@/components/finance/use-action-dialog";
import type { ProjectProgress } from "@/lib/finance/types";

/** Just the delivery side of a project, for a quick update after a stand-up. */
export function ProjectProgressDialog({
  children,
  project,
}: {
  children: React.ReactNode;
  project: {
    id: string;
    name: string;
    progress: ProjectProgress;
    progressPercent: number;
    progressNotes: string | null;
  };
}) {
  const { state, formAction, pending, open, setOpen } = useActionDialog(updateProjectProgress);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update progress</DialogTitle>
          <DialogDescription>{project.name}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="contents">
          <input type="hidden" name="id" value={project.id} />
          <DialogBody className="space-y-4">
            <FormAlert state={state} />
            {/* Keyed on open so each opening starts from what's saved. */}
            <ProgressFields
              key={String(open)}
              errors={state.fieldErrors}
              initialProgress={project.progress}
              initialPercent={project.progressPercent}
              initialNotes={project.progressNotes ?? ""}
            />
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pending={pending}>Save progress</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One tap to close out a project from its page. */
export function MarkCompletedButton({ projectId }: { projectId: string }) {
  const { formAction, pending } = useActionForm(markProjectCompleted);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={projectId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <CheckCheck className="text-positive" />}
        Mark completed
      </Button>
    </form>
  );
}
