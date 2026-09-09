import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma";

/**
 * Prisma 7 connects through a driver adapter rather than a URL in the schema.
 * The client is cached on globalThis so Next.js hot reloads reuse one pool
 * instead of exhausting Postgres connections.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // Thrown at import time so a missing variable fails the build loudly, rather
  // than deploying an app that errors on its first request.
  throw new Error(
    "DATABASE_URL is not set.\n" +
      "  • Locally:  copy .env.example to .env and point it at your PostgreSQL instance.\n" +
      "  • Vercel:   add it under Project Settings → Environment Variables, for every\n" +
      "              environment you deploy (Production, Preview, Development), then redeploy.",
  );
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type { Prisma } from "@/generated/prisma";
