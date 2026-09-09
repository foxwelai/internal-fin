import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 keeps the connection URL out of schema.prisma.
 *
 * Migrations need a session-level connection: they take advisory locks and set
 * session state, neither of which survives a transaction pooler. Managed
 * Postgres that fronts the database with PgBouncer — Neon, Supabase — therefore
 * needs its direct endpoint here, while the app itself keeps using the pooled
 * one at runtime. DIRECT_URL is optional; a plain PostgreSQL instance can leave
 * it unset and both paths use the same URL.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});
