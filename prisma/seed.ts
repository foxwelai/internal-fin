/**
 * Bootstraps the installation, and optionally loads the demo dataset.
 *
 *   npm run db:seed        — first super admin + app settings
 *   npm run db:seed:demo   — the above, plus the labelled demo dataset
 *
 * Sign-in is Clerk's job, so no password is created here. This only records
 * that SUPER_ADMIN_EMAIL is approved as a super admin; the person gets in the
 * first time they sign in to Clerk with that email, once Clerk has verified it.
 * It does nothing once any super admin exists — people are managed from
 * Settings -> Team after that.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma";
import { clearDemoData, seedDemoData } from "../src/lib/demo-data";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env first.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function bootstrapSuperAdmin() {
  const superAdmins = await prisma.user.count({
    where: { role: "SUPER_ADMIN", isActive: true, approvedAt: { not: null } },
  });
  if (superAdmins > 0) {
    console.log(`A super admin already exists (${superAdmins}) — accounts left untouched.`);
    return;
  }

  const email = (process.env.SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!email) {
    console.error("SUPER_ADMIN_EMAIL is not set — needed to approve the first super admin.");
    process.exit(1);
  }

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: process.env.SUPER_ADMIN_NAME?.trim() || email.split("@")[0],
      role: "SUPER_ADMIN",
      approvedAt: new Date(),
    },
    update: { role: "SUPER_ADMIN", approvedAt: new Date(), isActive: true },
  });

  console.log(`Approved ${user.email} as super admin. Sign in to Clerk with that email to get in.`);
}

async function main() {
  await bootstrapSuperAdmin();

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
