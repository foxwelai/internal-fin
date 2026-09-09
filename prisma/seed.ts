/**
 * Bootstraps the installation, and optionally loads the demo dataset.
 *
 *   npm run db:seed        — first owner account + app settings
 *   npm run db:seed:demo   — the above, plus the labelled demo dataset
 *
 * The owner account is a *bootstrap*, not a source of truth: once any account
 * exists, people are managed from Settings → Team and this script will not
 * touch them. In particular it never overwrites a password, so re-running it
 * after someone has changed theirs cannot silently reset it.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma";
import { clearDemoData, seedDemoData } from "../src/lib/demo-data";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env first.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function bootstrapOwner() {
  const existing = await prisma.user.count();

  if (existing > 0) {
    const owners = await prisma.user.count({ where: { role: "OWNER", isActive: true } });
    console.log(
      `Accounts already exist (${existing}, of which ${owners} active owner${owners === 1 ? "" : "s"}) — left untouched.`,
    );
    if (owners === 0) {
      console.warn(
        "\n  WARNING: no active owner. Nobody can manage people or settings.\n" +
          "  Promote someone directly in the database, or delete the users table\n" +
          "  and re-run this seed to bootstrap again.\n",
      );
    }
    return;
  }

  const email = (process.env.OWNER_EMAIL ?? "").trim().toLowerCase();
  const name = process.env.OWNER_NAME?.trim() || "Owner";
  const password = process.env.OWNER_PASSWORD;

  if (!email) {
    console.error("OWNER_EMAIL is not set — needed to create the first account.");
    process.exit(1);
  }
  if (!password || password.length < 12) {
    console.error(
      "OWNER_PASSWORD must be set and at least 12 characters — there is no default password.",
    );
    process.exit(1);
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      role: "OWNER",
      passwordHash: await bcrypt.hash(password, 12),
    },
  });

  console.log(`Bootstrapped the first owner: ${user.email}`);
  console.log("Everyone else is added from Settings → Team inside the app.");
}

async function main() {
  await bootstrapOwner();

  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", companyName: "foxwel.ai" },
    update: {},
  });

  if (process.argv.includes("--demo")) {
    await clearDemoData(prisma);
    await seedDemoData(prisma);
    console.log("Demo dataset loaded (every row flagged isDemo).");
  } else {
    console.log("Skipped demo data. Run `npm run db:seed:demo` to load it.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
