import Link from "next/link";

import { Money } from "@/components/finance/money";
import { Meter } from "@/components/ui/progress";
import { PROJECT_STATUS_LABELS } from "@/lib/finance/labels";
import type { PipelineTotals } from "@/lib/finance/types";
import { percentOf } from "@/lib/money";

const ACCENT = {
  APPROVED: { bar: "bg-positive", dot: "bg-positive" },
  PENDING: { bar: "bg-warning", dot: "bg-warning" },
  ON_HOLD: { bar: "bg-neutral", dot: "bg-neutral" },
} as const;

/**
 * Contract value by status. Approved work is what the forecast draws on;
 * pending and on-hold work is shown here and nowhere else, so it can never
 * quietly inflate a month.
 */
export function PipelineCard({ totals }: { totals: PipelineTotals[] }) {
  const grandTotal = totals.reduce((sum, row) => sum + row.budgetPaise, 0n);

  return (
    <ul className="space-y-3.5">
      {totals.map((row) => {
        const share = percentOf(row.budgetPaise, grandTotal) ?? 0;
        return (
          <li key={row.status}>
            <Link
              href={`/clients?tab=projects&status=${row.status}`}
              className="block rounded-md px-1 py-1 transition-colors hover:bg-surface-2"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 text-[13px]">
                  <span
                    aria-hidden
                    className={`size-1.5 rounded-full ${ACCENT[row.status].dot}`}
                  />
                  {PROJECT_STATUS_LABELS[row.status]}
                  <span className="font-mono tabular text-[11px] text-faint-foreground">
                    {row.projectCount}
                  </span>
                </span>
                <Money value={row.budgetPaise} className="text-[13px] font-medium" />
              </div>
              <Meter
                value={share}
                className="mt-2"
                barClassName={ACCENT[row.status].bar}
                label={`${PROJECT_STATUS_LABELS[row.status]} share of total contract value`}
              />
              <p className="mt-1.5 text-[11px] text-faint-foreground">
                <Money value={row.receivedPaise} compact className="text-[11px]" /> collected ·{" "}
                <Money value={row.remainingPaise} compact className="text-[11px]" /> outstanding
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
