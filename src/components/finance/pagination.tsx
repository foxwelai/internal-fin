import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SearchParams } from "@/lib/finance/page-helpers";
import { withParams } from "@/lib/finance/page-helpers";

export const PAGE_SIZE = 25;

export function paginate<T>(rows: T[], page: number, size = PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, page), pageCount);
  return {
    rows: rows.slice((current - 1) * size, current * size),
    page: current,
    pageCount,
    total: rows.length,
    from: rows.length === 0 ? 0 : (current - 1) * size + 1,
    to: Math.min(current * size, rows.length),
  };
}

export function Pagination({
  page,
  pageCount,
  total,
  from,
  to,
  basePath,
  params,
  noun = "records",
}: {
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  basePath: string;
  params: SearchParams;
  noun?: string;
}) {
  if (total === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5">
      <p className="font-mono tabular text-[12px] text-faint-foreground">
        {from}–{to} of {total} {noun}
      </p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-1.5">
          <Button asChild variant="outline" size="icon-sm" disabled={page <= 1}>
            <Link
              href={`${basePath}${withParams(params, { page: String(page - 1) })}`}
              aria-label="Previous page"
              aria-disabled={page <= 1}
              className={page <= 1 ? "pointer-events-none opacity-40" : undefined}
            >
              <ChevronLeft />
            </Link>
          </Button>
          <span className="font-mono tabular text-[12px] text-muted-foreground">
            {page} / {pageCount}
          </span>
          <Button asChild variant="outline" size="icon-sm">
            <Link
              href={`${basePath}${withParams(params, { page: String(page + 1) })}`}
              aria-label="Next page"
              aria-disabled={page >= pageCount}
              className={page >= pageCount ? "pointer-events-none opacity-40" : undefined}
            >
              <ChevronRight />
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
