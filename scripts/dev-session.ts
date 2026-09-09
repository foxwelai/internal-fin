/**
 * Mints a session cookie for an existing account, so the authenticated UI can
 * be exercised in development without typing a password into a form.
 *
 *   npx tsx scripts/dev-session.ts [email]
 *
 * Development only — it needs AUTH_SECRET, and it will not run in production.
 */
import "dotenv/config";
import { encode } from "@auth/core/jwt";

import { prisma } from "../src/lib/db";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to mint a session in production.");
  }
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");

  const email = (process.argv[2] ?? process.env.OWNER_EMAIL ?? "").toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No account for ${email}`);
  if (!user.isActive) throw new Error(`${email} is deactivated`);

  const token = await encode({
    token: { id: user.id, sub: user.id, name: user.name, email: user.email },
    secret,
    salt: "authjs.session-token",
    maxAge: 60 * 60 * 6,
  });

  console.log(token);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
