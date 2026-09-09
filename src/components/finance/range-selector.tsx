"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type RangePreset = "month" | "quarter" | "year" | "custom";

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
  { value: "custom", label: "Custom" },
];

/**
 * Analytics range, held in the URL alongside the global month so the two never
 * disagree about which period is on screen.
 */
export function RangeSelector({
  preset,
  from,
  to,
}: {
  preset: RangePreset;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draft, setDraft] = React.useState({ from, to });
  const [syncedFrom, setSyncedFrom] = React.useState({ from, to });

  // Adjust during render rather than in an effect (see SearchInput).
  if (syncedFrom.from !== from || syncedFrom.to !== to) {
    setSyncedFrom({ from, to });
    setDraft({ from, to });
  }

  const apply = (changes: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) params.delete(key);
      else params.set(key, value);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
        {PRESETS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={preset === option.value}
            onClick={() =>
              apply({
                range: option.value,
                ...(option.value === "custom" ? { from: draft.from, to: draft.to } : {}),
              })
            }
            className={cn(
              "rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
              preset === option.value
                ? "bg-surface-3 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {preset === "custom" ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Input
            type="month"
            value={draft.from}
            onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
            aria-label="Range start month"
            className="h-9 w-[10.5rem]"
          />
          <span className="text-[13px] text-faint-foreground">to</span>
          <Input
            type="month"
            value={draft.to}
            onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
            aria-label="Range end month"
            className="h-9 w-[10.5rem]"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => apply({ range: "custom", from: draft.from, to: draft.to })}
          >
            Apply
          </Button>
        </div>
      ) : null}
    </div>
  );
}
