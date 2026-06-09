/**
 * 存量用户 billingPersona 回填 + PLATFORM 自动托管 Key
 *
 * 用法：
 *   npx tsx scripts/backfill-billing-persona.ts [--conflict=byok|platform]
 */
import { prisma } from "../lib/prisma";
import {
  ensurePlatformManagedKeyForTenant,
  ensurePlatformManagedKeyForUser,
} from "../lib/gateway/platform-managed-key";

type ConflictPolicy = "byok" | "platform";

function parseConflictPolicy(): ConflictPolicy {
  const arg = process.argv.find((a) => a.startsWith("--conflict="));
  const v = arg?.split("=")[1]?.trim();
  return v === "platform" ? "platform" : "byok";
}

async function inferPersona(userId: string, conflict: ConflictPolicy) {
  const now = new Date();

  const [byokPersonal, creditAcc, teamPlan] = await Promise.all([
    prisma.byokSubscription.findFirst({
      where: {
        ownerType: "USER",
        ownerId: userId,
        status: "ACTIVE",
        periodEnd: { gt: now },
      },
    }),
    prisma.creditAccount.findUnique({
      where: { ownerType_ownerId: { ownerType: "USER", ownerId: userId } },
      select: { planId: true, monthlyGrantCredits: true, currentPeriodEnd: true },
    }),
    prisma.tenantMember.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        tenant: {
          type: "TEAM",
          planId: { not: null },
          OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
        },
      },
    }),
  ]);

  const hasCredit =
    Boolean(
      creditAcc?.planId &&
        creditAcc.monthlyGrantCredits > 0 &&
        (!creditAcc.currentPeriodEnd || creditAcc.currentPeriodEnd > now),
    ) || Boolean(teamPlan);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { gatewayApiKeyId: true },
  });
  let hasManualKey = false;
  if (user?.gatewayApiKeyId) {
    const key = await prisma.gatewayApiKey.findUnique({
      where: { id: user.gatewayApiKeyId },
      select: { managedByPlatform: true },
    });
    hasManualKey = Boolean(key && !key.managedByPlatform);
  }

  const hasByok = Boolean(byokPersonal) || hasManualKey;

  if (hasByok && hasCredit) {
    return conflict === "byok" ? "BYOK" : "PLATFORM_CREDIT";
  }
  if (hasByok) return "BYOK";
  if (hasCredit) return "PLATFORM_CREDIT";
  return "PLATFORM_CREDIT";
}

async function main() {
  const conflict = parseConflictPolicy();
  console.log(`[backfill] conflict policy: ${conflict}`);

  const users = await prisma.user.findMany({
    select: { id: true, billingPersonaLockedAt: true },
  });

  let locked = 0;
  let keys = 0;
  let teamKeys = 0;

  for (const u of users) {
    if (u.billingPersonaLockedAt) continue;

    const persona = await inferPersona(u.id, conflict);
    await prisma.user.update({
      where: { id: u.id },
      data: {
        billingPersona: persona,
        billingPersonaLockedAt: new Date(),
        ecomBillingMode: persona === "PLATFORM_CREDIT" ? "PLATFORM_METERED" : "BYOK_SERVICE_FEE",
      },
    });
    locked++;

    if (persona === "PLATFORM_CREDIT") {
      try {
        await ensurePlatformManagedKeyForUser(u.id);
        keys++;
      } catch (e) {
        console.warn(`[backfill] user ${u.id} auto-key failed:`, (e as Error).message);
      }
    }
  }

  const teams = await prisma.tenant.findMany({
    where: { type: "TEAM", gatewayApiKeyId: null },
    select: { id: true, ownerUserId: true },
  });

  for (const t of teams) {
    const owner = await prisma.user.findUnique({
      where: { id: t.ownerUserId },
      select: { billingPersona: true },
    });
    if (owner?.billingPersona !== "PLATFORM_CREDIT") continue;
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
