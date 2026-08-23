import { prisma } from "@/lib/prisma";
import { isMembershipServiceActive } from "@/lib/billing/membership-service-period";

/** 可分享用户的身份口径：个人订阅 vs 团队主账号。 */
export type ReferralSharePersona = "personal" | "team_owner";

/** 有效团队 OWNER 的租户 id（团队套餐未过期）。 */
export async function getActiveTeamOwnerTenantId(userId: string): Promise<string | null> {
  const now = new Date();
  const row = await prisma.tenantMember.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      role: "OWNER",
      tenant: {
        type: "TEAM",
        status: "ACTIVE",
        planId: { not: null },
        OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
      },
    },
    select: { tenantId: true },
  });
  return row?.tenantId ?? null;
}

export async function isActiveTeamOwner(userId: string): Promise<boolean> {
  return (await getActiveTeamOwnerTenantId(userId)) != null;
}

/** 用户是否有有效个人 PERSONAL 订阅（不含团队身份推断）。 */
export async function hasActivePersonalMembership(userId: string): Promise<boolean> {
  const now = new Date();
  const acc = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "USER", ownerId: userId } },
    select: { planId: true, monthlyGrantCredits: true, membershipPaidUntil: true },
  });
  if (!acc?.planId || acc.monthlyGrantCredits <= 0) return false;
  if (!isMembershipServiceActive(acc.membershipPaidUntil, now)) return false;
  const plan = await prisma.membershipPlan.findUnique({
    where: { id: acc.planId },
    select: { family: true },
  });
  return plan?.family === "PERSONAL";
}
