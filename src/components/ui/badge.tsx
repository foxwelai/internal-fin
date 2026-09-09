import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default: "border-border-strong bg-surface-3 text-muted-foreground",
        brand: "border-brand-line bg-brand-soft text-brand",
        positive: "border-positive/35 bg-positive-soft text-positive",
        negative: "border-negative/35 bg-negative-soft text-negative",
        warning: "border-warning/35 bg-warning-soft text-warning",
        info: "border-info/35 bg-info-soft text-info",
        outline: "border-border bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
