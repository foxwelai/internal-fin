import { describe, expect, it } from "vitest";

import {
  cloudinaryResourceTypeFor,
  DEFAULT_FOLDER,
  readCloudinaryConfig,
  signCloudinaryParams,
} from "./cloudinary-config";

describe("cloudinary config", () => {
  it("signs exactly as Cloudinary's documentation example", () => {
    expect(
      signCloudinaryParams(
        { eager: "w_400,h_300,c_pad|w_260,h_200,c_crop", public_id: "sample_image", timestamp: 1315060510 },
        "abcd",
      ),
    ).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
  });

  it("leaves out the fields Cloudinary never signs, whatever order they arrive in", () => {
    const base = { timestamp: 1, public_id: "x", type: "authenticated" };
    expect(signCloudinaryParams({ ...base, api_key: "k", file: "data", resource_type: "raw" }, "s")).toBe(
      signCloudinaryParams({ type: "authenticated", public_id: "x", timestamp: 1 }, "s"),
    );
  });

  it("reads the dashboard URL or the three separate variables", () => {
    expect(readCloudinaryConfig({ CLOUDINARY_URL: "cloudinary://123:s3cr%2Ft@foxwel" })).toEqual({
      apiKey: "123",
      apiSecret: "s3cr/t",
      cloudName: "foxwel",
      folder: DEFAULT_FOLDER,
    });
    expect(
      readCloudinaryConfig({
        CLOUDINARY_CLOUD_NAME: "foxwel",
        CLOUDINARY_API_KEY: "123",
        CLOUDINARY_API_SECRET: "secret",
        CLOUDINARY_FOLDER: "/bills/",
      }),
    ).toEqual({ cloudName: "foxwel", apiKey: "123", apiSecret: "secret", folder: "bills" });
  });

  it("is off unless fully configured", () => {
    expect(readCloudinaryConfig({})).toBeNull();
    expect(readCloudinaryConfig({ CLOUDINARY_CLOUD_NAME: "foxwel", CLOUDINARY_API_KEY: "123" })).toBeNull();
    expect(readCloudinaryConfig({ CLOUDINARY_URL: "https://nope" })).toBeNull();
  });

  it("files PDFs as raw and photos as images", () => {
    expect(cloudinaryResourceTypeFor("application/pdf")).toBe("raw");
    expect(cloudinaryResourceTypeFor("image/jpeg")).toBe("image");
  });
});
