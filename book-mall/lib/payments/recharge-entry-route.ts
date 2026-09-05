import { isMembershipServiceActive } from "@/lib/billing/membership-service-period";
import { prisma } from "@/lib/prisma";

export type RechargeEntryPath = "/account/billing" | "/pricing";

/**
 * 顶栏「积分充值 / 轻量包」入口分流：
 * - 会员服务有效（个人/团队）→ 轻量包选档页
 * - 曾开通但已过期 → 订阅报价页续费
 * - 从未开通套餐（仅赠送/充值积分）→ 仍可进轻量包页
 */
export async function resolveRechargeEntryPath(
  userId: string,
): Promise<RechargeEntryPath> {
  const now = new Date();

  const creditAcc = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: { ownerType: "USER", ownerId: userId } },
    select: { planId: true, membershipPaidUntil: true },
  });

  if (creditAcc?.planId) {
    return isMembershipServiceActive(creditAcc.membershipPaidUntil, now)
      ? "/account/billing"
      : "/pricing";
  }

  const teamMember = await prisma.tenantMember.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      tenant: {
        type: "TEAM",
        status: "ACTIVE",
        planId: { not: null },
      },
    },
    select: {
      tenant: { select: { currentPeriodEnd: true } },
    },
  });

  if (teamMember?.tenant) {
    return isMembershipServiceActive(teamMember.tenant.currentPeriodEnd, now)
      ? "/account/billing"
      : "/pricing";
  }

  return "/account/billing";
}

export function appendReturnToQuery(
  path: RechargeEntryPath,
  returnTo: string | null | undefined,
): string {
  const safe = returnTo?.trim();
  if (!safe) return path;
  const params = new URLSearchParams();
  params.set("returnTo", safe);
  return `${path}?${params.toString()}`;
}
