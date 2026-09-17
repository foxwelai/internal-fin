import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Wraps the table so wide financial columns scroll inside the card, never the page.
 * `relative` matters: rows hold visually-hidden (absolutely positioned) dialog
 * triggers, and without a positioned ancestor here they escape the scroll box
 * and widen the whole page on tablets.
 */
function TableWrap({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("relative w-full overflow-x-auto", className)} {...props} />;
}

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return <table className={cn("w-full caption-bottom border-collapse text-sm", className)} {...props} />;
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("[&_tr]:border-b [&_tr]:border-border", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      className={cn("border-t border-border bg-surface-2 font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "border-b border-border transition-colors last:border-0 hover:bg-surface-2/70 data-[state=selected]:bg-surface-2",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "h-9 whitespace-nowrap px-3 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-faint-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("px-3 py-2.5 align-middle", className)} {...props} />;
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption className={cn("mt-3 text-[13px] text-muted-foreground", className)} {...props} />;
}

export { TableWrap, Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
