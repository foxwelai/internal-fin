import { cn } from "@/lib/utils";
import { formatINR, formatINRCompact, type Paise } from "@/lib/money";

export type MoneyTone = "default" | "muted" | "positive" | "negative" | "brand" | "warning" | "auto";

const TONE_CLASS: Record<Exclude<MoneyTone, "auto">, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  positive: "text-positive",
  negative: "text-negative",
  brand: "text-brand",
  warning: "text-warning",
};

/**
 * The only way money is rendered. Always monospace with tabular figures so
 * columns line up, always Indian grouping, always the same rounding.
 */
export function Money({
  value,
  tone = "default",
  compact = false,
  decimals = false,
  signed = false,
  className,
  title,
}: {
  value: Paise;
  tone?: MoneyTone;
  compact?: boolean;
  decimals?: boolean;
  signed?: boolean;
  className?: string;
  title?: string;
}) {
  const resolvedTone: Exclude<MoneyTone, "auto"> =
    tone === "auto" ? (value > 0n ? "positive" : value < 0n ? "negative" : "muted") : tone;

  const text = compact
    ? formatINRCompact(value)
    : formatINR(value, { decimals, signed });

  return (
    <span
      className={cn("font-mono tabular", TONE_CLASS[resolvedTone], className)}
      // Compact figures keep the exact amount one hover away.
      title={title ?? (compact ? formatINR(value, { decimals: true }) : undefined)}
    >
      {text}
    </span>
  );
}
