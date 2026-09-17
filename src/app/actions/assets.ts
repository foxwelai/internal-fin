"use server";

import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkBill } from "@/lib/bill-file";
import {
  cloudinary,
  CloudinaryError,
  deleteFromCloudinary,
  uploadToCloudinary,
} from "@/lib/cloudinary";
import { assetSchema } from "@/lib/validation/schemas";

import {
  failure,
  formValue,
  fromZodError,
  revalidateFinance,
  runAction,
  success,
  type ActionState,
} from "./helpers";

type BillUpload = { fileName: string; contentType: string; sizeBytes: number; data: Uint8Array<ArrayBuffer> };

type StoredBill = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  data: Uint8Array<ArrayBuffer> | null;
  cloudinaryPublicId: string | null;
  cloudinaryResourceType: string | null;
};

/**
 * Sends the bill to Cloudinary when it is configured, and otherwise keeps it
 * in the database so the feature still works on a machine without the keys.
 */
async function storeBill(bill: BillUpload): Promise<StoredBill> {
  const config = cloudinary();
  if (!config) {
    return { ...bill, cloudinaryPublicId: null, cloudinaryResourceType: null };
  }
  const uploaded = await uploadToCloudinary(config, {
    bytes: bill.data,
    contentType: bill.contentType,
    extension: bill.fileName.split(".").pop() ?? "bin",
  });
  return {
    fileName: bill.fileName,
    contentType: bill.contentType,
    sizeBytes: bill.sizeBytes,
    data: null,
    cloudinaryPublicId: uploaded.publicId,
    cloudinaryResourceType: uploaded.resourceType,
  };
}

/** Removes a replaced or deleted bill's file from Cloudinary, if it lives there. */
async function discardStoredFile(bill: { cloudinaryPublicId: string | null; cloudinaryResourceType: string | null } | null) {
  const config = cloudinary();
  if (!config || !bill?.cloudinaryPublicId || !bill.cloudinaryResourceType) return;
  await deleteFromCloudinary(config, bill.cloudinaryPublicId, bill.cloudinaryResourceType);
}

/**
 * Reads the optional `bill` file from the form. An empty file input still
 * arrives as a zero-byte File, which simply means "no new bill".
 */
async function readBill(formData: FormData): Promise<BillUpload | null | { error: string }> {
  const file = formData.get("bill");
  if (!(file instanceof File) || file.size === 0) return null;
  const data = new Uint8Array(await file.arrayBuffer());
  const checked = checkBill(data, file.name);
  if (!checked.ok) return { error: checked.message };
  return { fileName: checked.fileName, contentType: checked.contentType, sizeBytes: data.byteLength, data };
}

/** Reuses a category whatever its capitalisation, so the list stays tidy. */
async function resolveCategory(categoryId: string, newCategory: string | null): Promise<string | null> {
  if (newCategory) {
    const name = newCategory.replace(/\s+/g, " ").trim();
    const category = await prisma.assetCategory.upsert({
      where: { nameKey: name.toLowerCase() },
      create: { name, nameKey: name.toLowerCase() },
      update: {},
    });
    return category.id;
  }
  const existing = await prisma.assetCategory.findUnique({ where: { id: categoryId } });
  return existing?.id ?? null;
}

export async function saveAsset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:write");

    const parsed = assetSchema.safeParse({
      id: formValue(formData, "id") || undefined,
      name: formValue(formData, "name"),
      categoryId: formValue(formData, "categoryId"),
      newCategory: formValue(formData, "newCategory"),
      specification: formValue(formData, "specification"),
      serialNumber: formValue(formData, "serialNumber"),
      purchasedOn: formValue(formData, "purchasedOn"),
      cost: formValue(formData, "cost"),
      notes: formValue(formData, "notes"),
    });
    if (!parsed.success) return fromZodError(parsed.error);

    const bill = await readBill(formData);
    if (bill && "error" in bill) return failure(bill.error, { bill: [bill.error] });

    const { id, categoryId: chosen, newCategory, cost, ...rest } = parsed.data;
    const categoryId = await resolveCategory(chosen, chosen === "new" ? newCategory : null);
    if (!categoryId) {
      return failure("That category no longer exists — choose another.", { categoryId: ["Not found"] });
    }

    const data = { ...rest, categoryId, costPaise: cost };

    let stored: StoredBill | null = null;
    if (bill) {
      try {
        stored = await storeBill(bill);
      } catch (error) {
        if (error instanceof CloudinaryError) {
          console.error("[assets]", error.message);
          return failure("The bill couldn't be uploaded to Cloudinary. Nothing was saved — try again.", {
            bill: ["Upload failed"],
          });
        }
        throw error;
      }
    }

    if (id) {
      const previous = stored
        ? await prisma.assetBill.findUnique({
            where: { assetId: id },
            select: { cloudinaryPublicId: true, cloudinaryResourceType: true },
          })
        : null;
      await prisma.asset.update({
        where: { id },
        data: {
          ...data,
          ...(stored
            ? { bill: { upsert: { create: stored, update: { ...stored, uploadedAt: new Date() } } } }
            : {}),
        },
      });
      if (previous) await discardStoredFile(previous);
      revalidateFinance();
      return success(stored ? `${rest.name} updated, with the new bill.` : `${rest.name} updated.`);
    }

    const created = await prisma.asset.create({
      data: { ...data, ...(stored ? { bill: { create: stored } } : {}) },
    });
    revalidateFinance();
    return success(`${rest.name} added${bill ? " with its bill" : ""}.`, created.id);
  });
}

export async function removeAssetBill(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:delete");

    const id = formValue(formData, "id");
    if (!id) return failure("Missing asset reference.");

    const bill = await prisma.assetBill.findUnique({
      where: { assetId: id },
      select: { id: true, cloudinaryPublicId: true, cloudinaryResourceType: true },
    });
    if (!bill) return failure("There was no bill to remove.");

    await prisma.assetBill.delete({ where: { id: bill.id } });
    await discardStoredFile(bill);
    revalidateFinance();
    return success("Bill removed.");
  });
}

export async function deleteAsset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("finance:delete");

    const id = formValue(formData, "id");
    if (!id) return failure("Missing asset reference.");

    const asset = await prisma.asset.findUnique({
      where: { id },
      select: { name: true, bill: { select: { cloudinaryPublicId: true, cloudinaryResourceType: true } } },
    });
    if (!asset) return failure("That asset no longer exists.");

    // The bill row goes with it (cascade). An emptied category is kept for reuse.
    await prisma.asset.delete({ where: { id } });
    await discardStoredFile(asset.bill);
    revalidateFinance();
    return success(`${asset.name} deleted.`);
  });
}
