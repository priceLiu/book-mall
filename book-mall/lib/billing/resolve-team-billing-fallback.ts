/**
 * 团队成员在个人池无余额时，回落到有效团队共享池（PLATFORM_CREDIT）。
 */
import { getCreditBalance, getPoolBalances } from "@/lib/billing/credit-account-service";
import { prisma } from "@/lib/prisma";

/** 返回可用于扣费的团队 tenantId；无则 null。 */
export async function resolveTeamBillingFallbackTenantId(
  actorUserId: string,
): Promise<string | null> {
  const personalBalance = await getCreditBalance({
    ownerType: "USER",
    ownerId: actorUserId,
  }).catch(() => 0);
  if (personalBalance > 0) return null;

  const memberships = await prisma.tenantMember.findMany({
    where: {
      userId: actorUserId,
      status: "ACTIVE",
      tenant: {
        type: "TEAM",
        status: "ACTIVE",
        planId: { not: null },
        OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }],
      },
    },
    orderBy: { joinedAt: "desc" },
    select: { tenantId: true },
  });

  for (const m of memberships) {
    const pools = await getPoolBalances({
      ownerType: "TENANT",
      ownerId: m.tenantId,
    }).catch(() => null);
    if (!pools) continue;
    const available = pools.general.balance + pools.video.balance;
    if (available > 0) return m.tenantId;
  }
  return null;
}
