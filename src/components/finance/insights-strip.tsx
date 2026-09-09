import Link from "next/link";
import { ArrowRight, CircleAlert, Info, TrendingUp, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/finance/types";

const TONE = {
  neutral: { icon: Info, className: "border-border bg-surface-2 text-muted-foreground", accent: "text-faint-foreground" },
  positive: { icon: TrendingUp, className: "border-positive/25 bg-positive-soft text-foreground", accent: "text-positive" },
  warning: { icon: TriangleAlert, className: "border-warning/25 bg-warning-soft text-foreground", accent: "text-warning" },
  negative: { icon: CircleAlert, className: "border-negative/25 bg-negative-soft text-foreground", accent: "text-negative" },
} as const;

/**
 * Deterministic commentary, generated from stored figures by fixed rules.
 * Nothing here is inferred or written by a model.
 */
export function InsightsStrip({ insights, limit }: { insights: Insight[]; limit?: number }) {
  const shown = limit ? insights.slice(0, limit) : insights;
  if (shown.length === 0) return null;

  return (
    <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {shown.map((insight) => {
        const tone = TONE[insight.tone];
        const Icon = tone.icon;
        const body = (
          <>
            <Icon className={cn("mt-px size-4 shrink-0", tone.accent)} />
            <span className="min-w-0 flex-1 text-[13px] leading-relaxed">{insight.text}</span>
            {insight.href ? (
              <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-faint-foreground transition-transform group-hover:translate-x-0.5" />
            ) : null}
          </>
        );

        const shell = cn(
          "group flex items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
          tone.className,
          insight.href && "hover:border-border-strong",
        );

        return (
          <li key={insight.id}>
            {insight.href ? (
              <Link href={insight.href} className={shell}>
                {body}
              </Link>
            ) : (
              <div className={shell}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
