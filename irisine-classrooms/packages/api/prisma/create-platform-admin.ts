/**
 * Creates (or resets the password of) the PLATFORM_SUPER_ADMIN, the owner of the whole SaaS.
 * This is the ONLY way such an account is created: there is no signup or API for it.
 *
 *   PLATFORM_ADMIN_EMAIL=owner@yourcompany.com PLATFORM_ADMIN_PASSWORD='long-password' \
 *   PLATFORM_ADMIN_NAME='Owner' npx ts-node prisma/create-platform-admin.ts
 *
 * It never deletes anything. Run it yourself, once, against the database you intend.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

async function main() {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  const name = process.env.PLATFORM_ADMIN_NAME?.trim() || 'Platform Owner';
  if (!email || !password) throw new Error('Set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD');
  if (password.length < 12) throw new Error('PLATFORM_ADMIN_PASSWORD must be at least 12 characters');

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await prisma.platformAdmin.upsert({
      where: { email },
      create: { email, passwordHash, name },
      update: { passwordHash, name, isActive: true },
    });
    console.log(`Platform admin ready: ${admin.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
