import "server-only";

import { randomBytes } from "node:crypto";

import {
  cloudinaryResourceTypeFor,
  readCloudinaryConfig,
  signCloudinaryParams,
  type CloudinaryConfig,
} from "./cloudinary-config";

/**
 * Bill storage in Cloudinary.
 *
 * Files are uploaded as type "authenticated": they have no public URL, and
 * the app fetches them with a signed API call only after checking the viewer
 * is approved. The API secret never leaves the server.
 */

export class CloudinaryError extends Error {}

export function cloudinary(): CloudinaryConfig | null {
  return readCloudinaryConfig(process.env);
}

const api = (config: CloudinaryConfig, resourceType: string, action: string) =>
  `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/${resourceType}/${action}`;

const timestamp = () => Math.floor(Date.now() / 1000);

async function failureText(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function uploadToCloudinary(
  config: CloudinaryConfig,
  file: { bytes: Uint8Array<ArrayBuffer>; contentType: string; extension: string },
): Promise<{ publicId: string; resourceType: "image" | "raw" }> {
  const resourceType = cloudinaryResourceTypeFor(file.contentType);
  const unique = `bill-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}`;
  // Raw files keep their extension in the id; images get theirs from Cloudinary.
  const publicId = `${config.folder}/${unique}${resourceType === "raw" ? `.${file.extension}` : ""}`;

  const params = { public_id: publicId, timestamp: timestamp(), type: "authenticated" };
  const form = new FormData();
  form.set("file", new Blob([file.bytes], { type: file.contentType }));
  for (const [key, value] of Object.entries(params)) form.set(key, String(value));
  form.set("api_key", config.apiKey);
  form.set("signature", signCloudinaryParams(params, config.apiSecret));

  const response = await fetch(api(config, resourceType, "upload"), { method: "POST", body: form });
  if (!response.ok) {
    throw new CloudinaryError(`Cloudinary refused the upload: ${await failureText(response)}`);
  }
  const body = (await response.json()) as { public_id: string };
  return { publicId: body.public_id, resourceType };
}

export async function fetchFromCloudinary(
  config: CloudinaryConfig,
  publicId: string,
  resourceType: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const params = { public_id: publicId, timestamp: timestamp(), type: "authenticated" };
  const query = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
    api_key: config.apiKey,
    signature: signCloudinaryParams(params, config.apiSecret),
  });

  const response = await fetch(`${api(config, resourceType, "download")}?${query}`, { cache: "no-store" });
  if (!response.ok) {
    throw new CloudinaryError(`Cloudinary could not return the bill: ${await failureText(response)}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

/** Best effort: a file left behind costs storage, not correctness. */
export async function deleteFromCloudinary(
  config: CloudinaryConfig,
  publicId: string,
  resourceType: string,
): Promise<void> {
  const params = { invalidate: "true", public_id: publicId, timestamp: timestamp(), type: "authenticated" };
  const form = new FormData();
  for (const [key, value] of Object.entries(params)) form.set(key, String(value));
  form.set("api_key", config.apiKey);
  form.set("signature", signCloudinaryParams(params, config.apiSecret));
  try {
    const response = await fetch(api(config, resourceType, "destroy"), { method: "POST", body: form });
    if (!response.ok) console.error("[cloudinary] destroy failed", publicId, await failureText(response));
  } catch (error) {
    console.error("[cloudinary] destroy failed", publicId, error);
  }
}
