import * as React from "react";
import { Banknote, Repeat } from "lucide-react";

import { Money } from "@/components/finance/money";
import { Badge } from "@/components/ui/badge";
import { Meter } from "@/components/ui/progress";
import { formatDay, formatRelativeDay } from "@/lib/dates";
import { percentOf, type Paise } from "@/lib/money";
import { EXPENSE_CATEGORY_COLORS, EXPENSE_CATEGORY_LABELS } from "@/lib/finance/labels";
import type { ExpenseRollup } from "@/lib/finance/types";

/**
 * The phone view of a month's budget.
 *
 * A seven-column table cannot survive 390px: the money columns end up off the
 * right edge, which hides the only figures anyone opens this page for. Each
 * expense becomes a block instead, so name, category, due date, the three
 * amounts and the pay button are all on screen at once.
 */
export function ExpenseCards({
  rows,
  today,
  renderActions,
  renderPay,
}: {
  rows: ExpenseRollup[];
  today: Date;
  renderActions?: (row: ExpenseRollup) => React.ReactNode;
  renderPay?: (row: ExpenseRollup) => React.ReactNode;
}) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => {
        const paidShare = percentOf(row.paidPaise, row.expense.plannedPaise) ?? 0;
        const isPaid = row.outstandingPaise === 0n;

        return (
          <li key={row.expense.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[14px] font-medium leading-tight">
                  <span className="truncate">{row.expense.name}</span>
                  {row.expense.isRecurring ? (
                    <Repeat className="size-3 shrink-0 text-faint-foreground" aria-label="Recurring" />
                  ) : null}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-2 rounded-[2px]"
                      style={{ backgroundColor: EXPENSE_CATEGORY_COLORS[row.expense.category] }}
                    />
                    {EXPENSE_CATEGORY_LABELS[row.expense.category]}
                  </span>
                  {row.expense.dueDate ? (
                    <>
                      <span className="text-faint-foreground">·</span>
                      <span className="font-mono tabular">{formatDay(row.expense.dueDate)}</span>
                      {!isPaid ? (
                        <span className={row.state === "OVERDUE" ? "text-negative" : "text-faint-foreground"}>
                          {formatRelativeDay(row.expense.dueDate, today)}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </p>
              </div>
              {renderActions ? <div className="-mr-1 shrink-0">{renderActions(row)}</div> : null}
            </div>

            <dl className="mt-3 grid grid-cols-3 gap-2">
              <Amount label="Planned" value={row.expense.plannedPaise} />
              <Amount label="Paid" value={row.paidPaise} tone={row.paidPaise > 0n ? "positive" : "muted"} />
              <Amount
                label="Outstanding"
                value={row.outstandingPaise}
                tone={row.state === "OVERDUE" ? "negative" : "default"}
              />
            </dl>

            <Meter
              value={paidShare}
              className="mt-2.5"
              barClassName={isPaid ? "bg-positive" : "bg-brand"}
              label={`${Math.round(paidShare)}% paid`}
            />

            <div className="mt-3 flex items-center justify-between gap-2">
              {isPaid ? (
                <Badge variant="positive">Paid in full</Badge>
              ) : (
                <Badge variant={row.state === "OVERDUE" ? "negative" : "outline"}>
                  {row.state === "OVERDUE" ? "Overdue" : row.paidPaise > 0n ? "Part paid" : "Unpaid"}
                </Badge>
              )}
              {!isPaid && renderPay ? renderPay(row) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Amount({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: Paise;
  tone?: "default" | "positive" | "negative" | "muted";
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-faint-foreground">
        {label}
      </dt>
      {/* Exact, never rounded: this is the figure someone came to check. */}
      <dd className="mt-0.5">
        <Money value={value} tone={tone} className="block truncate text-[14px] font-medium" />
      </dd>
    </div>
  );
}

/** Pay-button icon, so the page and the card list stay visually consistent. */
export const PayIcon = Banknote;
