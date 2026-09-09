/**
 * Optional local PostgreSQL, for working offline.
 *
 * `embedded-postgres` ships a ~130 MB server binary per platform, which is dead
 * weight in a deployment build, so it is not a declared dependency. This script
 * loads it on demand and tells you how to install it if you want it. Normally
 * you point DATABASE_URL at a real database — Neon, RDS, anything — and never
 * run this at all.
 */

type EmbeddedPostgresCtor = new (options: Record<string, unknown>) => {
  initialise: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  createDatabase: (name: string) => Promise<void>;
};

async function loadEmbeddedPostgres(): Promise<EmbeddedPostgresCtor> {
  try {
    // Not a declared dependency, so this specifier is resolved at runtime only.
    const loaded = await import("embedded-postgres" as string);
    return (loaded as { default: EmbeddedPostgresCtor }).default;
  } catch {
    console.error(
      "\n  A local PostgreSQL server is not installed.\n\n" +
        "  Either point DATABASE_URL at a real database (recommended), or run:\n\n" +
        "    npm install --no-save embedded-postgres\n\n" +
        "  then `npm run db:start` again. It downloads a ~130 MB server binary.\n",
    );
    process.exit(1);
  }
}
import { existsSync } from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), ".devdb");
const PORT = Number(process.env.DEV_DB_PORT ?? 55432);
const USER = process.env.DEV_DB_USER ?? "foxwel";
const PASSWORD = process.env.DEV_DB_PASSWORD ?? "foxwel";
const DATABASE = process.env.DEV_DB_NAME ?? "foxwel_finance";

async function main() {
  const EmbeddedPostgres = await loadEmbeddedPostgres();
  const alreadyInitialised = existsSync(path.join(DATA_DIR, "PG_VERSION"));

  const server = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
    // SQL_ASCII is initdb's default under a C locale; force UTF-8 so rupee
    // symbols and en-dashes in notes round-trip exactly.
    initdbFlags: ["--encoding=UTF8", "--lc-collate=C", "--lc-ctype=C"],
  });

  if (!alreadyInitialised) {
    process.stdout.write("Initialising local PostgreSQL cluster in .devdb ...\n");
    await server.initialise();
  }

  await server.start();

  try {
    await server.createDatabase(DATABASE);
    process.stdout.write(`Created database "${DATABASE}".\n`);
  } catch {
    // Already exists — the normal case on restart.
  }

  const url = `postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DATABASE}`;
  process.stdout.write(`\n  PostgreSQL ready\n  DATABASE_URL=${url}\n\n  Press Ctrl+C to stop.\n\n`);

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    process.stdout.write("\nStopping PostgreSQL ...\n");
    await server.stop().catch(() => {});
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  // Keep the event loop alive.
  setInterval(() => {}, 1 << 30);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
