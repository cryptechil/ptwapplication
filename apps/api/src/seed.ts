import { prisma } from './db.js';
import { hashPassword } from './auth.js';
import { env } from './env.js';

export async function ensureSeedAdmin() {
  const adminCount = await prisma.user.count({ where: { role: 'admin' } });
  if (adminCount > 0) return;
  if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD) {
    console.warn('No admin exists and SEED_ADMIN_* env vars not set; skipping seed.');
    return;
  }
  await prisma.user.create({
    data: {
      email: env.SEED_ADMIN_EMAIL.toLowerCase(),
      passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD),
      name: env.SEED_ADMIN_NAME ?? 'Administrator',
      role: 'admin',
    },
  });
  console.log(`Seeded initial admin: ${env.SEED_ADMIN_EMAIL}`);
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  ensureSeedAdmin().then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
