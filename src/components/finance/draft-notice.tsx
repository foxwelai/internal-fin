"use client";

import { History } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Says plainly that earlier typing was brought back, and offers a way out.
 * Restoring silently would be worse than losing the text: nobody expects a
 * form to be pre-filled, and a stale draft could be saved without being read.
 */
export function DraftNotice({
  restored,
  onDiscard,
}: {
  restored: boolean;
  onDiscard: () => void;
}) {
  if (!restored) return null;

  return (
    <div className="flex items-center gap-2 rounded-md border border-info/30 bg-info-soft px-3 py-2">
      <History className="size-3.5 shrink-0 text-info" />
      <span className="min-w-0 flex-1 text-[12px] leading-relaxed text-info">
        Restored what you had typed before.
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 shrink-0 px-2 text-[12px] text-info hover:text-foreground"
        onClick={onDiscard}
      >
        Start fresh
      </Button>
    </div>
  );
}
