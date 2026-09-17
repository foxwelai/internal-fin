/**
 * Asset bills: a photo of the receipt or the PDF invoice.
 *
 * The type is decided from the file's first bytes, never from its name or the
 * browser's claim, and the bill is served back with that type only. An HTML
 * file renamed to bill.pdf is refused rather than stored and later rendered.
 */

/** Stays under Vercel's 4.5MB request ceiling once the form's other fields ride along. */
export const MAX_BILL_BYTES = 3_500_000;

export const BILL_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";

export type BillType = "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | "image/heic";

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

export function detectBillType(bytes: Uint8Array): BillType | null {
  if (startsWith(bytes, ascii("%PDF-"))) return "application/pdf";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "image/webp";
  // ISO media "ftyp" box with a HEIF brand — what an iPhone camera produces.
  if (startsWith(bytes, ascii("ftyp"), 4)) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(brand)) return "image/heic";
  }
  return null;
}

export type BillCheck =
  | { ok: true; contentType: BillType; fileName: string }
  | { ok: false; message: string };

export function checkBill(bytes: Uint8Array, name: string): BillCheck {
  if (bytes.byteLength === 0) return { ok: false, message: "That file is empty." };
  if (bytes.byteLength > MAX_BILL_BYTES) {
    return { ok: false, message: "The bill must be 3.5MB or smaller — try a photo or a compressed PDF." };
  }
  const contentType = detectBillType(bytes);
  if (!contentType) {
    return { ok: false, message: "Upload the bill as a PDF or a photo (JPEG, PNG, WebP or HEIC)." };
  }
  return { ok: true, contentType, fileName: safeFileName(name, contentType) };
}

const EXTENSIONS: Record<BillType, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

/** A name that is safe inside a Content-Disposition header and matches its type. */
export function safeFileName(name: string, contentType: BillType): string {
  const base =
    name
      .replace(/\.[^.]*$/, "")
      .replace(/[^\w.-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "bill";
  return `${base}.${EXTENSIONS[contentType]}`;
}
