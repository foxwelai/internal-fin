import { describe, expect, it } from "vitest";

import { checkBill, detectBillType, MAX_BILL_BYTES, safeFileName } from "./bill-file";

const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(parts.flatMap((part) => (typeof part === "string" ? [...part].map((c) => c.charCodeAt(0)) : part)));

describe("bill files", () => {
  it("recognises what a phone or scanner actually produces", () => {
    expect(detectBillType(bytes("%PDF-1.7\n"))).toBe("application/pdf");
    expect(detectBillType(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectBillType(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectBillType(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "))).toBe("image/webp");
    expect(detectBillType(bytes([0, 0, 0, 24], "ftypheic"))).toBe("image/heic");
  });

  it("goes by the bytes, not the name", () => {
    const html = bytes("<html><script>alert(1)</script>");
    expect(detectBillType(html)).toBeNull();
    expect(checkBill(html, "invoice.pdf").ok).toBe(false);
    // An MP4 shares the ftyp box but is not a HEIF image.
    expect(detectBillType(bytes([0, 0, 0, 24], "ftypisom"))).toBeNull();
  });

  it("refuses empty and oversized files", () => {
    expect(checkBill(new Uint8Array(), "bill.pdf").ok).toBe(false);
    const big = new Uint8Array(MAX_BILL_BYTES + 1);
    big.set(bytes("%PDF-"));
    expect(checkBill(big, "bill.pdf").ok).toBe(false);
  });

  it("names the stored file after its real type, safely", () => {
    expect(safeFileName("Mac mini bill (final).PDF", "application/pdf")).toBe("Mac-mini-bill-final.pdf");
    expect(safeFileName('x"; filename="evil.html', "image/jpeg")).toBe("x-filename-evil.jpg");
    expect(safeFileName("", "image/png")).toBe("bill.png");
    const ok = checkBill(bytes([0xff, 0xd8, 0xff, 0xdb]), "IMG_0042.HEIC");
    expect(ok).toEqual({ ok: true, contentType: "image/jpeg", fileName: "IMG_0042.jpg" });
  });
});
