"use server";

import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { clearDemoData, seedDemoData } from "@/lib/demo-data";

import { failure, revalidateFinance, runAction, success, type ActionState } from "./helpers";

export async function loadDemoData(): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("settings:manage");

    const existing = await prisma.client.count({ where: { isDemo: true } });
    if (existing > 0) {
      return failure("Demo data is already loaded. Remove it first to load a fresh copy.");
    }

    await prisma.$transaction(async (tx) => {
      await seedDemoData(tx);
    }, { timeout: 30_000 });

    revalidateFinance();
    return success(
      "Demo data loaded — five fictional clients, ten projects and six months of expenses. " +
        "Every row is labelled as demo and can be removed in one click.",
    );
  });
}

export async function removeDemoData(): Promise<ActionState> {
  return runAction(async () => {
    await requirePermission("settings:manage");

    await prisma.$transaction(async (tx) => {
      await clearDemoData(tx);
    });

    revalidateFinance();
    return success("Demo data removed. Nothing else was touched.");
  });
}
