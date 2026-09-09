"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[page]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-10 items-center justify-center rounded-lg border border-negative/35 bg-negative-soft">
        <TriangleAlert className="size-5 text-negative" />
      </div>
      <h1 className="text-lg font-semibold tracking-tight">This page could not be loaded</h1>
      <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">
        No data was changed. This is usually the database being unreachable — check that
        PostgreSQL is running and that <code className="font-mono text-foreground">DATABASE_URL</code>{" "}
        is correct, then try again.
      </p>
      {error.digest ? (
        <p className="font-mono tabular text-[11px] text-faint-foreground">ref {error.digest}</p>
      ) : null}
      <Button onClick={reset} className="mt-2">
        <RefreshCw />
        Try again
      </Button>
    </div>
  );
}
