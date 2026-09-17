"use client";

import * as React from "react";
import { Download, FileText, FileX, MoreHorizontal, Paperclip, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AssetDialog,
  type AssetCategoryOption,
  type AssetInitial,
} from "@/components/dialogs/asset-dialog";
import { ConfirmAction } from "@/components/finance/confirm-action";
import { deleteAsset, removeAssetBill } from "@/app/actions/assets";

export function AssetRowActions({
  asset,
  categories,
  canWrite,
  canDelete,
}: {
  asset: AssetInitial;
  categories: AssetCategoryOption[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const [confirm, setConfirm] = React.useState<null | "delete" | "bill">(null);
  const editTrigger = React.useRef<HTMLButtonElement>(null);
  const billHref = `/api/assets/${asset.id}/bill`;

  if (!asset.bill && !canWrite) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${asset.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {asset.bill ? (
            <>
              <DropdownMenuItem asChild>
                <a href={billHref} target="_blank" rel="noreferrer">
                  <FileText />
                  View bill
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`${billHref}?download=1`}>
                  <Download />
                  Download bill
                </a>
              </DropdownMenuItem>
            </>
          ) : null}
          {canWrite ? (
            <>
              {asset.bill ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem onSelect={() => setTimeout(() => editTrigger.current?.click(), 0)}>
                {asset.bill ? <Pencil /> : <Paperclip />}
                {asset.bill ? "Edit" : "Edit / add bill"}
              </DropdownMenuItem>
            </>
          ) : null}
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              {asset.bill ? (
                <DropdownMenuItem onSelect={() => setTimeout(() => setConfirm("bill"), 0)}>
                  <FileX />
                  Remove bill
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setTimeout(() => setConfirm("delete"), 0)}
              >
                <Trash2 />
                Delete asset
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {canWrite ? (
        <AssetDialog categories={categories} initial={asset}>
          <button type="button" ref={editTrigger} className="sr-only" aria-hidden tabIndex={-1} />
        </AssetDialog>
      ) : null}

      <ConfirmAction
        open={confirm === "bill"}
        onOpenChange={(open) => setConfirm(open ? "bill" : null)}
        action={removeAssetBill}
        hidden={{ id: asset.id }}
        title={`Remove the bill for ${asset.name}?`}
        description="The stored file is deleted. The asset stays on the register."
        confirmLabel="Remove bill"
      />

      <ConfirmAction
        open={confirm === "delete"}
        onOpenChange={(open) => setConfirm(open ? "delete" : null)}
        action={deleteAsset}
        hidden={{ id: asset.id }}
        title={`Delete ${asset.name}?`}
        description="The asset and its bill are removed permanently. Expenses recorded for the purchase are not touched."
        confirmLabel="Delete permanently"
      />
    </>
  );
}
