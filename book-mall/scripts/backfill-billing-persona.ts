/**
 * 存量用户 billingPersona 回填 + PLATFORM 自动托管 Key
 *
 * 用法：
 *   npx tsx scripts/backfill-billing-persona.ts
 */
import { prisma } from "../lib/prisma";
import {
  ensurePlatformManagedKeyForTenant,
  ensurePlatformManagedKeyForUser,
} from "../lib/gateway/platform-managed-key";

async function main() {
  console.log("[backfill] 统一回填为平台代付");

  const users = await prisma.user.findMany({
    select: { id: true, billingPersonaLockedAt: true },
  });

  let locked = 0;
  let keys = 0;
  let teamKeys = 0;

  for (const u of users) {
    if (u.billingPersonaLockedAt) continue;

    await prisma.user.update({
      where: { id: u.id },
      data: {
        billingPersona: "PLATFORM_CREDIT",
        billingPersonaLockedAt: new Date(),
        ecomBillingMode: "PLATFORM_METERED",
      },
    });
    locked++;

    try {
      await ensurePlatformManagedKeyForUser(u.id);
      keys++;
    } catch (e) {
      console.warn(`[backfill] user ${u.id} auto-key failed:`, (e as Error).message);
    }
  }

  const teams = await prisma.tenant.findMany({
    where: { type: "TEAM", gatewayApiKeyId: null },
    select: { id: true, ownerUserId: true },
  });

  for (const t of teams) {
    try {
      await ensurePlatformManagedKeyForTenant(t.id);
      teamKeys++;
    } catch (e) {
      console.warn(`[backfill] tenant ${t.id} auto-key failed:`, (e as Error).message);
    }
  }

  console.log(`[backfill] locked persona: ${locked}, personal keys: ${keys}, team keys: ${teamKeys}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
