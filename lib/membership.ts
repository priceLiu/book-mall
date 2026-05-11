import { prisma } from "@/lib/prisma";

/** 是否具备「高级会员」状态：订阅有效且可用余额 ≥ 最低余额线 */
export async function getMembershipFlags(userId: string): Promise<{
  hasActiveSubscription: boolean;
  subscriptionEndsAt: Date | null;
  balanceMinor: number;
  minBalanceLineMinor: number;
  canUsePremiumMetered: boolean;
}> {
  const now = new Date();

  const [config, wallet, sub] = await Promise.all([
    prisma.platformConfig.findUnique({ where: { id: "default" } }),
    prisma.wallet.findUnique({ where: { userId } }),
    prisma.subscription.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        currentPeriodEnd: { gt: now },
      },
      orderBy: { currentPeriodEnd: "desc" },
    }),
  ]);

  const minLine = config?.minBalanceLineMinor ?? 2000;
  const balanceMinor = wallet?.balanceMinor ?? 0;
  const hasActiveSubscription = Boolean(sub);
  const canUsePremiumMetered =
    hasActiveSubscription && balanceMinor >= minLine;

  return {
    hasActiveSubscription,
    subscriptionEndsAt: sub?.currentPeriodEnd ?? null,
    balanceMinor,
    minBalanceLineMinor: minLine,
    canUsePremiumMetered,
  };
}
