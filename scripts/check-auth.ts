/**
 * Exercises the same credential check Auth.js `authorize()` performs, so the
 * sign-in path can be verified without submitting a password through a form.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";

import { prisma } from "../src/lib/db";

async function main() {
  const email = (process.env.OWNER_EMAIL ?? "owner@foxwel.ai").toLowerCase();
  const password = process.env.OWNER_PASSWORD ?? "";

  const user = await prisma.user.findUnique({ where: { email } });
  console.log("account found:      ", Boolean(user));
  console.log("role:               ", user?.role);
  console.log("hash algorithm:     ", user?.passwordHash.slice(0, 4), "(bcrypt)");
  console.log("cost factor:        ", user?.passwordHash.split("$")[2]);
  console.log("correct password:   ", await bcrypt.compare(password, user!.passwordHash));
  console.log("wrong password:     ", await bcrypt.compare(`${password}x`, user!.passwordHash));
  console.log("empty password:     ", await bcrypt.compare("", user!.passwordHash));
  console.log(
    "plaintext stored?   ",
    user!.passwordHash.includes(password) ? "YES — BUG" : "no",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
