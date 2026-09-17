import { createHash } from "node:crypto";

/**
 * Cloudinary settings and request signing — pure functions, so they can be
 * tested without the network.
 *
 * Configure with either the single URL Cloudinary's dashboard shows:
 *   CLOUDINARY_URL="cloudinary://<api_key>:<api_secret>@<cloud_name>"
 * or the three parts separately:
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 * Optionally CLOUDINARY_FOLDER (default "foxwel-finance/asset-bills").
 */

export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
};

export const DEFAULT_FOLDER = "foxwel-finance/asset-bills";

export function readCloudinaryConfig(env: Record<string, string | undefined>): CloudinaryConfig | null {
  const folder = (env.CLOUDINARY_FOLDER?.trim() || DEFAULT_FOLDER).replace(/^\/+|\/+$/g, "");

  const url = env.CLOUDINARY_URL?.trim();
  if (url) {
    const match = /^cloudinary:\/\/([^:]+):([^@]+)@([^/?#]+)/.exec(url);
    if (!match) return null;
    return {
      apiKey: decodeURIComponent(match[1]),
      apiSecret: decodeURIComponent(match[2]),
      cloudName: match[3],
      folder,
    };
  }

  const cloudName = env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret, folder };
}

/**
 * Cloudinary's API signature: parameters sorted by name, joined as
 * `key=value&…`, the secret appended, SHA-1 in hex. `file`, `api_key`,
 * `resource_type` and `cloud_name` are never part of it.
 */
export function signCloudinaryParams(
  params: Record<string, string | number | boolean | undefined>,
  apiSecret: string,
): string {
  const excluded = new Set(["file", "api_key", "resource_type", "cloud_name"]);
  const payload = Object.keys(params)
    .filter((key) => !excluded.has(key) && params[key] !== undefined && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(payload + apiSecret).digest("hex");
}

/** PDFs go up as "raw": Cloudinary blocks delivering PDFs as images by default. */
export function cloudinaryResourceTypeFor(contentType: string): "image" | "raw" {
  return contentType.startsWith("image/") ? "image" : "raw";
}
