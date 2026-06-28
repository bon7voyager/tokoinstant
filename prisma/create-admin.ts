/**
 * Bootstrap (or promote) an ADMIN account. Useful on a fresh/empty database —
 * including the first admin on production, since registration via the UI only
 * creates regular USER accounts.
 *
 * Usage:
 *   npm run create-admin -- <email> <password> [name]
 *   npx tsx prisma/create-admin.ts admin@kilat.shop "StrongPass123" "Admin Kilat"
 *
 * Idempotent: if the email already exists, it's promoted to ADMIN and its
 * password is reset to the one given.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [emailArg, password, nameArg] = process.argv.slice(2);
  if (!emailArg || !password) {
    console.error('Usage: npm run create-admin -- <email> <password> [name]');
    process.exit(1);
  }
  const email = emailArg.toLowerCase().trim();
  if (password.length < 6) {
    console.error("Password minimal 6 karakter.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const name = (nameArg ?? "Admin").trim();

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: passwordHash, role: "ADMIN" },
    create: { email, name, password: passwordHash, role: "ADMIN" },
  });

  console.log(`✅ Admin siap: ${user.email} (role ${user.role}, nama "${user.name}")`);
  if (password.length < 12 || /^(admin|password)\d*$/i.test(password)) {
    console.warn("⚠️  Password lemah/mudah ditebak — ganti ke yang kuat sebelum live.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
