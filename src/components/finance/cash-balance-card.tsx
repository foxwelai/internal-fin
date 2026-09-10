import Link from "next/link";
import { Landmark } from "lucide-react";

import { Money } from "@/components/finance/money";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/dates";
import type { CashPosition } from "@/lib/finance/types";

/**
 * A bank-style running balance. Funding and owner draws move it without ever
 * touching collections, expenses or the surplus — which is why they are listed
 * on their own line here.
 */
export function CashBalanceCard({ position }: { position: CashPosition | null }) {
  if (!position) {
    return (
      <div className="flex flex-col justify-between rounded-xl border border-dashed border-border bg-card p-5">
        <div>
          <div className="mb-2 flex size-9 items-center justify-center rounded-lg border border-border bg-surface-2">
            <Landmark className="size-4 text-faint-foreground" />
          </div>
          <p className="text-[13px] font-medium">Cash balance not tracked</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            Set an opening balance and its effective date, and this card starts showing a running
            cash position alongside the operating result.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="mt-4 self-start">
          <Link href="/settings#cash">Set opening balance</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card surface-sheen p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_8px_24px_-16px_rgba(0,0,0,0.9)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-faint-foreground">
            Cash balance
          </span>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            At {formatDay(position.asOf)}
          </p>
        </div>
        <Link
          href="/settings#cash"
          className="rounded-md p-1 text-faint-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
          aria-label="Cash settings"
        >
          <Landmark className="size-4" />
        </Link>
      </div>

      <Money
        value={position.closingBalancePaise}
        tone={position.closingBalancePaise >= 0n ? "default" : "negative"}
        className="mt-3 block text-[26px] font-semibold leading-8 tracking-tight sm:text-[28px]"
      />

      <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-[12px]">
        <Row label={`Opening (${formatDay(position.effectiveDate)})`}>
          <Money value={position.openingBalancePaise} tone="muted" className="text-[12px]" />
        </Row>
        <Row label="Collections in">
          <Money value={position.operatingInflowPaise} tone="positive" className="text-[12px]" />
        </Row>
        <Row label="Expenses out">
          <Money value={-position.operatingOutflowPaise} tone="negative" className="text-[12px]" />
        </Row>
        <Row label="Borrowing, net of repayments">
          <Money value={position.financingNetPaise} tone="auto" signed className="text-[12px]" />
        </Row>
        <Row label="Funding & owner movements">
          <Money value={position.nonOperatingNetPaise} tone="auto" signed className="text-[12px]" />
        </Row>
      </dl>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
