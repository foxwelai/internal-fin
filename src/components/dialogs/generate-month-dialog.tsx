"use client";

import * as React from "react";
import { CopyPlus, Loader2, RefreshCw } from "lucide-react";

import {
  applyMonthGeneration,
  previewMonthGeneration,
  type GenerationPreview,
} from "@/app/actions/expenses";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FormAlert, SubmitButton } from "@/components/finance/form-kit";
import { useActionDialog } from "@/components/finance/use-action-dialog";
import { Money } from "@/components/finance/money";
import { EmptyState } from "@/components/finance/empty-state";
import { cn } from "@/lib/utils";

/**
 * Generation is always preview-then-confirm, and always idempotent: anything
 * already present for the month is listed as skipped rather than added twice.
 */
export function GenerateMonthDialog({
  children,
  mode,
  month,
  monthLabel,
  defaultSourceMonth,
}: {
  children: React.ReactNode;
  mode: "templates" | "copy";
  month: string;
  monthLabel: string;
  /** Previous month, for the copy flow. */
  defaultSourceMonth: string;
}) {
  const { state, formAction, pending, open, setOpen } = useActionDialog(applyMonthGeneration);
  const [sourceMonth, setSourceMonth] = React.useState(defaultSourceMonth);
  const [preview, setPreview] = React.useState<GenerationPreview | null>(null);
  const [loading, setLoading] = React.useState(false);

  /**
   * The preview is fetched from the event that needs it — opening the dialog,
   * or changing the month to copy from — rather than from an effect watching
   * `open`. The source month is passed in explicitly so a fetch triggered by
   * the picker cannot read a stale value.
   */
  const load = React.useCallback(
    async (from: string) => {
      setLoading(true);
      try {
        setPreview(
          await previewMonthGeneration({
            mode,
            month,
            sourceMonth: mode === "copy" ? from : undefined,
          }),
        );
      } finally {
        setLoading(false);
      }
    },
    [mode, month],
  );

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void load(sourceMonth);
    else setPreview(null);
  };

  const total = preview ? BigInt(preview.totalPaise) : 0n;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "templates"
              ? `Generate ${monthLabel} from recurring templates`
              : `Copy a month into ${monthLabel}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "templates"
              ? "Each active template creates one independent expense line. Running this again adds nothing — templates already generated for this month are skipped."
              : "Copies the budget lines from another month. Anything with the same name and category already in this month is skipped."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="contents">
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="sourceMonth" value={sourceMonth} />

          <DialogBody className="space-y-4">
            <FormAlert state={state} />

            {mode === "copy" ? (
              <label className="flex items-center gap-2">
                <span className="w-28 shrink-0 text-[13px] text-muted-foreground">Copy from</span>
                <Input
                  type="month"
                  value={sourceMonth}
                  onChange={(event) => {
                    setSourceMonth(event.target.value);
                    void load(event.target.value);
                  }}
                  className="max-w-[12rem]"
                  aria-label="Month to copy from"
                />
              </label>
            ) : null}

            {loading ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-6 text-[13px] text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Building the preview…
              </div>
            ) : preview && !preview.ok ? (
              <p className="rounded-md border border-negative/35 bg-negative-soft px-3 py-2 text-[13px] text-negative">
                {preview.message}
              </p>
            ) : preview ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="positive">{preview.create.length} to add</Badge>
                  {preview.skip.length > 0 ? (
                    <Badge variant="warning">{preview.skip.length} skipped</Badge>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-[12px]"
                    onClick={() => void load(sourceMonth)}
                  >
                    <RefreshCw />
                    Refresh
                  </Button>
                </div>

                {preview.create.length === 0 ? (
                  <EmptyState
                    title="Nothing new to add"
                    description={
                      mode === "templates"
                        ? `Every active template already has a line in ${monthLabel}.`
                        : `Everything in that month is already present in ${monthLabel}.`
                    }
                    compact
                  />
                ) : (
                  <ul className="max-h-56 divide-y divide-border overflow-auto rounded-lg border border-border">
                    {preview.create.map((row, index) => (
                      <li
                        key={`${row.name}-${index}`}
                        className="flex items-center gap-3 px-3 py-2"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px]">{row.name}</span>
                          <span className="block text-[11px] text-faint-foreground">
                            {row.categoryLabel}
                            {row.dueDate ? ` · due ${row.dueDate}` : ""}
                          </span>
                        </span>
                        <Money value={BigInt(row.plannedPaise)} className="text-[13px]" />
                      </li>
                    ))}
                  </ul>
                )}

                {preview.skip.length > 0 ? (
                  <ul className="space-y-0.5 text-[12px] text-muted-foreground">
                    {preview.skip.map((row, index) => (
                      <li key={`${row.name}-${index}`} className={cn("truncate")}>
                        <span className="text-faint-foreground">Skipped</span> {row.name} — {row.reason}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="flex items-baseline justify-between rounded-md border border-border bg-surface-2 px-3 py-2 text-[13px]">
                  <span className="text-muted-foreground">Added to the {monthLabel} budget</span>
                  <Money value={total} />
                </div>
              </>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton
              pending={pending}
              disabled={pending || loading || !preview?.ok || preview.create.length === 0}
            >
              <CopyPlus />
              Add {preview?.create.length ?? 0} expense
              {preview?.create.length === 1 ? "" : "s"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
