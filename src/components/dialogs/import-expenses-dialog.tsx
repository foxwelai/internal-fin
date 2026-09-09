"use client";

import * as React from "react";
import { CircleAlert, CircleCheck, FileSpreadsheet, Upload } from "lucide-react";

import { importExpenses } from "@/app/actions/expenses";
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
import { Badge } from "@/components/ui/badge";
import { FormAlert, SubmitButton } from "@/components/finance/form-kit";
import { useActionDialog } from "@/components/finance/use-action-dialog";
import { Money } from "@/components/finance/money";
import { parseCsv } from "@/lib/csv";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/finance/labels";
import type { ExpenseCategory } from "@/lib/finance/types";
import {
  buildImportPreview,
  guessMapping,
  IMPORT_FIELDS,
  type ImportFieldKey,
} from "@/lib/finance/import";
import { cn } from "@/lib/utils";

export function ImportExpensesDialog({
  children,
  month,
  monthLabel,
  existing,
}: {
  children: React.ReactNode;
  month: string;
  monthLabel: string;
  /** Name + category of what is already budgeted, for duplicate detection. */
  existing: { name: string; category: ExpenseCategory }[];
}) {
  const { state, formAction, pending, open, setOpen } = useActionDialog(importExpenses);

  const [fileName, setFileName] = React.useState<string | null>(null);
  const [parsed, setParsed] = React.useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [mapping, setMapping] = React.useState<Record<ImportFieldKey, string>>({
    name: "",
    category: "",
    planned: "",
    dueDate: "",
    notes: "",
  });
  const [readError, setReadError] = React.useState<string | null>(null);

  const reset = () => {
    setFileName(null);
    setParsed(null);
    setReadError(null);
    setMapping({ name: "", category: "", planned: "", dueDate: "", notes: "" });
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const handleFile = async (file: File) => {
    setReadError(null);
    try {
      const text = await file.text();
      const result = parseCsv(text);
      if (result.headers.length === 0 || result.rows.length === 0) {
        setReadError("That file has no data rows.");
        return;
      }
      setFileName(file.name);
      setParsed(result);
      setMapping(guessMapping(result.headers));
    } catch {
      setReadError("That file could not be read as CSV.");
    }
  };

  const preview = React.useMemo(
    () =>
      parsed
        ? buildImportPreview({
            headers: parsed.headers,
            rows: parsed.rows,
            mapping,
            existing,
          })
        : [],
    [parsed, mapping, existing],
  );

  const blocked = preview.filter((row) => row.blocked);
  const importable = preview.filter((row) => !row.blocked && !row.duplicate);
  const total = importable.reduce((sum, row) => sum + BigInt(row.plannedPaise), 0n);

  const payload = JSON.stringify({
    month,
    rows: importable.map((row) => ({
      name: row.name,
      category: row.category,
      plannedPaise: row.plannedPaise,
      dueDate: row.dueDate,
      notes: row.notes,
    })),
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import expenses into {monthLabel}</DialogTitle>
          <DialogDescription>
            Map your columns, check the preview, then import. Rows that already exist for this month
            are detected and skipped rather than duplicated.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="contents">
          <input type="hidden" name="payload" value={payload} />

          <DialogBody className="space-y-4">
            <FormAlert state={state} />

            {/* Step 1 — file */}
            <div className="rounded-lg border border-dashed border-border bg-surface-2/60 p-4 text-center">
              <FileSpreadsheet className="mx-auto size-5 text-faint-foreground" />
              <p className="mt-2 text-[13px] font-medium">
                {fileName ?? "Choose a CSV file"}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Any column order. Amounts may use Indian grouping, e.g. 3,60,000.
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleFile(file);
                    }}
                  />
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-3 px-2.5 text-[13px] font-medium hover:border-border-strong">
                    <Upload className="size-3.5" />
                    {parsed ? "Choose another file" : "Choose file"}
                  </span>
                </label>
                <Button asChild variant="ghost" size="sm" className="text-[12px]">
                  <a href="/api/template/expenses" download>
                    Download sample template
                  </a>
                </Button>
              </div>
              {readError ? <p className="mt-2 text-[12px] text-negative">{readError}</p> : null}
            </div>

            {/* Step 2 — mapping */}
            {parsed ? (
              <div className="space-y-2">
                <p className="text-[13px] font-medium">Match your columns</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {IMPORT_FIELDS.map((field) => (
                    <label key={field.key} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 text-[12px] text-muted-foreground">
                        {field.label}
                        {field.required ? <span className="text-brand">*</span> : null}
                      </span>
                      <select
                        value={mapping[field.key]}
                        onChange={(event) =>
                          setMapping((current) => ({ ...current, [field.key]: event.target.value }))
                        }
                        className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-2 text-[13px]"
                      >
                        <option value="">— not mapped —</option>
                        {parsed.headers.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Step 3 — preview */}
            {parsed ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-medium">Preview</p>
                  <Badge variant="positive">{importable.length} to import</Badge>
                  {preview.filter((row) => row.duplicate).length > 0 ? (
                    <Badge variant="warning">
                      {preview.filter((row) => row.duplicate).length} duplicate
                    </Badge>
                  ) : null}
                  {blocked.length > 0 ? (
                    <Badge variant="negative">{blocked.length} cannot import</Badge>
                  ) : null}
                </div>

                <div className="max-h-64 overflow-auto rounded-lg border border-border">
                  <table className="w-full text-[12px]">
                    <thead className="sticky top-0 bg-surface-2">
                      <tr className="border-b border-border">
                        <th className="px-2 py-1.5 text-left font-medium text-faint-foreground">Row</th>
                        <th className="px-2 py-1.5 text-left font-medium text-faint-foreground">Name</th>
                        <th className="px-2 py-1.5 text-left font-medium text-faint-foreground">Category</th>
                        <th className="px-2 py-1.5 text-right font-medium text-faint-foreground">Amount</th>
                        <th className="px-2 py-1.5 text-left font-medium text-faint-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row) => {
                        const isBlocked = row.blocked;
                        return (
                          <tr
                            key={row.index}
                            className={cn(
                              "border-b border-border last:border-0",
                              isBlocked && "bg-negative-soft",
                              !isBlocked && row.duplicate && "bg-warning-soft",
                            )}
                          >
                            <td className="px-2 py-1.5 font-mono tabular text-faint-foreground">
                              {row.index + 2}
                            </td>
                            <td className="max-w-[10rem] truncate px-2 py-1.5">{row.name || "—"}</td>
                            <td className="px-2 py-1.5 text-muted-foreground">
                              {EXPENSE_CATEGORY_LABELS[row.category]}
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <Money value={BigInt(row.plannedPaise)} className="text-[12px]" />
                            </td>
                            <td className="px-2 py-1.5">
                              {isBlocked ? (
                                <span className="flex items-center gap-1 text-negative">
                                  <CircleAlert className="size-3" />
                                  {row.problems[0]}
                                </span>
                              ) : row.duplicate ? (
                                <span className="text-warning">Already in {monthLabel} — skipped</span>
                              ) : row.problems.length > 0 ? (
                                <span className="text-warning">{row.problems[0]}</span>
                              ) : (
                                <span className="flex items-center gap-1 text-positive">
                                  <CircleCheck className="size-3" />
                                  Ready
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-baseline justify-between rounded-md border border-border bg-surface-2 px-3 py-2 text-[13px]">
                  <span className="text-muted-foreground">Total to be added</span>
                  <Money value={total} />
                </div>
              </div>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton pending={pending} disabled={pending || importable.length === 0}>
              Import {importable.length || ""} expense{importable.length === 1 ? "" : "s"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
