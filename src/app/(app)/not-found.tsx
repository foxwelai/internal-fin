import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-surface-2">
        <FileQuestion className="size-5 text-faint-foreground" />
      </div>
      <h1 className="text-lg font-semibold tracking-tight">Not found</h1>
      <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
        That client, project or record no longer exists — it may have been deleted.
      </p>
      <Button asChild variant="outline" className="mt-2">
        <Link href="/overview">Back to Overview</Link>
      </Button>
    </div>
  );
}
