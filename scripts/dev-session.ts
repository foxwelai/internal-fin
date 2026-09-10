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

  const [emailArg] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const email = (emailArg ?? process.env.OWNER_EMAIL ?? "").toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No account for ${email}`);
  if (!user.isActive) throw new Error(`${email} is deactivated`);

  // Auth.js derives the cookie name from the site URL's protocol, and uses that
  // same name as the JWT salt. Mirror the rule so a minted token matches
  // whatever the running app expects.
  const siteUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  const secureCookies = siteUrl ? siteUrl.startsWith("https://") : false;
  const cookieName = `${secureCookies ? "__Secure-" : ""}authjs.session-token`;

  const token = await encode({
    token: { id: user.id, sub: user.id, name: user.name, email: user.email },
    secret,
    salt: cookieName,
    maxAge: 60 * 60 * 6,
  });

  if (process.argv.includes("--with-name")) console.log(`${cookieName}=${token}`);
  else console.log(token);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
