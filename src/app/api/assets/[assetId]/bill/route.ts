import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cloudinary, fetchFromCloudinary } from "@/lib/cloudinary";

/**
 * Serves an asset's bill to approved accounts only — fetched from Cloudinary
 * server-side, so the file never has a public URL. Opens inline, so a phone
 * shows the photo or PDF straight away and the share sheet can send it on;
 * `?download=1` saves it instead.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const { assetId } = await params;
  const bill = await prisma.assetBill.findUnique({ where: { assetId } });
  if (!bill) return NextResponse.json({ error: "No bill for this asset" }, { status: 404 });

  let bytes: Uint8Array<ArrayBuffer>;
  if (bill.cloudinaryPublicId && bill.cloudinaryResourceType) {
    const config = cloudinary();
    if (!config) {
      return NextResponse.json(
        { error: "This bill is stored in Cloudinary, but Cloudinary is not configured here." },
        { status: 503 },
      );
    }
    try {
      bytes = await fetchFromCloudinary(config, bill.cloudinaryPublicId, bill.cloudinaryResourceType);
    } catch (error) {
      console.error("[bill]", error);
      return NextResponse.json({ error: "Could not fetch the bill from Cloudinary" }, { status: 502 });
    }
  } else if (bill.data) {
    bytes = new Uint8Array(bill.data);
  } else {
    return NextResponse.json({ error: "No bill for this asset" }, { status: 404 });
  }

  const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";

  return new NextResponse(bytes, {
    headers: {
      // Stored only after the bytes were identified, so this is never HTML.
      "Content-Type": bill.contentType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${disposition}; filename="${bill.fileName}"`,
      "X-Content-Type-Options": "nosniff",
      // Locks down image views. Not sent for PDFs: browsers' built-in PDF
      // viewers refuse to render under a restrictive policy.
      ...(bill.contentType.startsWith("image/")
        ? { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'" }
        : {}),
      "Cache-Control": "private, no-store",
    },
  });
}
