"use client";

import * as React from "react";
import { Camera, FileText, Loader2, Paperclip, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BILL_ACCEPT, MAX_BILL_BYTES } from "@/lib/bill-file";

/** Photos above this are re-encoded in the browser before they are sent. */
const SHRINK_ABOVE_BYTES = 900_000;
const MAX_EDGE = 2200;

/**
 * Phone cameras produce 3–6MB photos. Re-encoding to a 2200px JPEG keeps a
 * bill perfectly legible at a few hundred KB, and keeps uploads well inside
 * the request limit. Anything the browser cannot decode is sent untouched.
 */
async function shrinkPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= SHRINK_ABOVE_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]*$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/**
 * The bill field. On a phone or tablet "Take photo" opens the camera straight
 * away; "Choose file" offers the photo library, Files, or a PDF.
 */
export function BillPicker({
  existing,
  error,
}: {
  existing?: { href: string; fileName: string } | null;
  error?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = React.useState<{ name: string; size: number; preview: string | null } | null>(null);
  const [working, setWorking] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);

  // Release the preview's object URL when it is replaced or the dialog closes.
  React.useEffect(() => {
    const preview = chosen?.preview;
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [chosen?.preview]);

  const accept = async (file: File | undefined) => {
    setProblem(null);
    if (!file || !inputRef.current) return;
    setWorking(true);
    const ready = await shrinkPhoto(file);
    setWorking(false);

    if (ready.size > MAX_BILL_BYTES) {
      clear();
      setProblem("That file is over 3.5MB. Take a photo instead, or compress the PDF.");
      return;
    }

    // Whatever was picked — camera or files — rides in the one named input.
    const transfer = new DataTransfer();
    transfer.items.add(ready);
    inputRef.current.files = transfer.files;
    setChosen({
      name: ready.name,
      size: ready.size,
      preview: ready.type.startsWith("image/") ? URL.createObjectURL(ready) : null,
    });
  };

  const clear = () => {
    if (inputRef.current) inputRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
    setChosen(null);
  };

  const message = problem ?? error;

  return (
    <div className="space-y-2">
      <span className="text-[13px] font-medium leading-none text-muted-foreground">Bill</span>

      <input
        ref={inputRef}
        type="file"
        name="bill"
        accept={BILL_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        // Setting `files` from code fires no change event, so this cannot loop.
        onChange={(event) => void accept(event.target.files?.[0])}
      />
      {/* `capture` sends phones straight to the rear camera. Desktops ignore it. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => void accept(event.target.files?.[0])}
      />

      {chosen ? (
        <div className="flex items-center gap-3 rounded-md border border-border bg-surface-2 p-2">
          {chosen.preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an optimisable asset
            <img src={chosen.preview} alt="" className="size-12 shrink-0 rounded object-cover" />
          ) : (
            <span className="flex size-12 shrink-0 items-center justify-center rounded bg-surface-3">
              <FileText className="size-5 text-muted-foreground" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px]">{chosen.name}</p>
            <p className="font-mono tabular text-[11px] text-faint-foreground">
              {(chosen.size / 1024).toFixed(0)} KB{existing ? " · replaces the current bill" : ""}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={clear} aria-label="Remove chosen file">
            <X />
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="lg:hidden"
            disabled={working}
            onClick={() => cameraRef.current?.click()}
          >
            <Camera />
            Take photo
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={working}
            onClick={() => inputRef.current?.click()}
          >
            {working ? <Loader2 className="animate-spin" /> : <Paperclip />}
            {working ? "Preparing…" : existing ? "Replace bill" : "Choose file"}
          </Button>
          {existing ? (
            <a
              href={existing.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-w-0 items-center gap-1 text-[12px] text-brand hover:underline"
            >
              <FileText className="size-3.5 shrink-0" />
              <span className="truncate">{existing.fileName}</span>
            </a>
          ) : null}
        </div>
      )}

      {message ? (
        <p className="text-[12px] text-negative">{message}</p>
      ) : (
        <p className="text-[12px] leading-relaxed text-faint-foreground">
          PDF or photo, up to 3.5MB. Large photos are shrunk before upload.
        </p>
      )}
    </div>
  );
}
