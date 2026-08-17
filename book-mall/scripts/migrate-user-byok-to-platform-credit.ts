/**
 * 将指定用户从 BYOK 迁移为 PLATFORM_CREDIT（平台代付），并绑定平台托管 sk-gw。
 *
 * 用法：
 *   pnpm exec dotenv -e .env.local -- tsx scripts/migrate-user-byok-to-platform-credit.ts <email>
 */
import { prisma } from "../lib/prisma";
import { ensurePlatformManagedKeyForUser } from "../lib/gateway/platform-managed-key";

async function main() {
  const email = process.argv[2]?.trim();
  if (!email) {
    console.error("Usage: npx tsx scripts/migrate-user-byok-to-platform-credit.ts <email>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, billingPersona: true, ecomBillingMode: true },
  });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  console.log(
    `[migrate] ${user.email} before: persona=${user.billingPersona} ecom=${user.ecomBillingMode}`,
  );

  await prisma.user.update({
    where: { id: user.id },
    data: {
      billingPersona: "PLATFORM_CREDIT",
      ecomBillingMode: "PLATFORM_METERED",
    },
  });

  const keyId = await ensurePlatformManagedKeyForUser(user.id);
  console.log(`[migrate] done: PLATFORM_CREDIT, platform managed key=${keyId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
