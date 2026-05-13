import { prisma } from "@/lib/prisma";

/** 是否具备「高级会员」状态：订阅有效且可用余额 ≥ 最低余额线 */
export async function getMembershipFlags(userId: string): Promise<{
  hasActiveSubscription: boolean;
  /** 至少有一条有效的「单品工具」订阅（可与会员计划并行） */
  hasActiveToolProductSubscription: boolean;
  /** 至少有一条有效的「单品课程」订阅 */
  hasActiveCourseProductSubscription: boolean;
  /** 当前有效会员计划的展示名称（无则 null） */
  membershipPlanName: string | null;
  subscriptionEndsAt: Date | null;
  balanceMinor: number;
  minBalanceLineMinor: number;
  canUsePremiumMetered: boolean;
}> {
  const now = new Date();

  const [config, wallet, sub, toolProdCount, courseProdCount] = await Promise.all([
    prisma.platformConfig.findUnique({ where: { id: "default" } }),
    prisma.wallet.findUnique({ where: { userId } }),
    prisma.subscription.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        currentPeriodEnd: { gt: now },
      },
      orderBy: { currentPeriodEnd: "desc" },
      include: { plan: true },
    }),
    prisma.userProductSubscription.count({
      where: {
        userId,
        status: "ACTIVE",
        currentPeriodEnd: { gt: now },
        product: { kind: "TOOL" },
      },
    }),
    prisma.userProductSubscription.count({
      where: {
        userId,
        status: "ACTIVE",
        currentPeriodEnd: { gt: now },
        product: { kind: "KNOWLEDGE" },
      },
    }),
  ]);

  const minLine = config?.minBalanceLineMinor ?? 2000;
  const balanceMinor = wallet?.balanceMinor ?? 0;
  const hasActiveSubscription = Boolean(sub);
  const hasActiveToolProductSubscription = toolProdCount > 0;
  const hasActiveCourseProductSubscription = courseProdCount > 0;
  const canUsePremiumMetered =
    hasActiveSubscription && balanceMinor >= minLine;

  return {
    hasActiveSubscription,
    hasActiveToolProductSubscription,
    hasActiveCourseProductSubscription,
    membershipPlanName: sub?.plan.name ?? null,
    subscriptionEndsAt: sub?.currentPeriodEnd ?? null,
    balanceMinor,
    minBalanceLineMinor: minLine,
    canUsePremiumMetered,
  };
}
