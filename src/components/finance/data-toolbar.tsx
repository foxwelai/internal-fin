"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Search and filters live in the URL, so a filtered view can be shared, the
 * back button behaves, and the CSV export can honour exactly what is on screen.
 */
export function SearchInput({
  paramKey = "q",
  placeholder = "Search…",
  className,
}: {
  paramKey?: string;
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlValue = searchParams.get(paramKey) ?? "";
  const [value, setValue] = React.useState(urlValue);
  const [syncedFrom, setSyncedFrom] = React.useState(urlValue);
  const [isPending, startTransition] = React.useTransition();

  // Adjust state during render when the URL changes from elsewhere — a filter
  // chip, the back button. React's documented alternative to syncing in an
  // effect, and it re-renders before anything is painted.
  if (urlValue !== syncedFrom) {
    setSyncedFrom(urlValue);
    setValue(urlValue);
  }

  const push = React.useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.trim()) params.set(paramKey, next.trim());
      else params.delete(paramKey);
      params.delete("page");
      startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
    },
    [paramKey, pathname, router, searchParams],
  );

  React.useEffect(() => {
    if (value === urlValue) return;
    const timer = setTimeout(() => push(value), 250);
    return () => clearTimeout(timer);
  }, [value, urlValue, push]);

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn("pl-8", value && "pr-8", isPending && "opacity-70")}
      />
      {value ? (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-faint-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export type FilterOption = { value: string; label: string; count?: number };

/** A row of toggle chips that set (or clear) one query parameter. */
export function FilterChips({
  paramKey,
  options,
  allLabel = "All",
  className,
}: {
  paramKey: string;
  options: FilterOption[];
  allLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get(paramKey);

  const select = (value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(paramKey, value);
    else params.delete(paramKey);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const chip = (isActive: boolean) =>
    cn(
      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
      isActive
        ? "border-brand-line bg-brand-soft text-brand"
        : "border-border bg-surface-2 text-muted-foreground hover:border-border-strong hover:text-foreground",
    );

  return (
    <div className={cn("no-scrollbar flex items-center gap-1.5 overflow-x-auto", className)}>
      <button type="button" onClick={() => select(null)} className={chip(!active)}>
        {allLabel}
      </button>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => select(option.value)}
          className={chip(active === option.value)}
          aria-pressed={active === option.value}
        >
          {option.label}
          {option.count !== undefined ? (
            <span className="font-mono tabular text-[10px] opacity-70">{option.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/** Sets a single query parameter from a native select. */
export function ParamSelect({
  paramKey,
  options,
  label,
  defaultValue,
  className,
}: {
  paramKey: string;
  options: FilterOption[];
  label: string;
  defaultValue?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <select
      aria-label={label}
      value={searchParams.get(paramKey) ?? defaultValue ?? options[0]?.value}
      onChange={(event) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set(paramKey, event.target.value);
        params.delete("page");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }}
      className={cn(
        "h-9 rounded-md border border-border bg-surface-2 px-2.5 text-[13px] text-foreground",
        "hover:border-border-strong focus-visible:border-brand-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35",
        className,
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function ToggleParam({
  paramKey,
  label,
  className,
}: {
  paramKey: string;
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const on = searchParams.get(paramKey) === "1";

  return (
    <Button
      type="button"
      variant={on ? "secondary" : "outline"}
      size="sm"
      aria-pressed={on}
      className={className}
      onClick={() => {
        const params = new URLSearchParams(searchParams.toString());
        if (on) params.delete(paramKey);
        else params.set(paramKey, "1");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }}
    >
      {label}
    </Button>
  );
}
