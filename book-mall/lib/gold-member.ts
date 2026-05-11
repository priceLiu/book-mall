import { prisma } from "@/lib/prisma";

/**
 * 「黄金会员」——独立 AI 工具站准入（与站内「订阅 + 最低余额」的高级计量权益区分）。
 *
 * 条件（须同时满足）：
 * 1. 至少有一条钱包流水类型为 RECHARGE（历史上完成过充值入账）；
 * 2. 当前可用余额 ≥ 平台配置的最低余额线（默认 2000 分 = 20 元）。
 */
export async function getGoldMemberAccess(userId: string): Promise<{
  isGoldMember: boolean;
  balanceMinor: number;
  minBalanceLineMinor: number;
  hasRechargeHistory: boolean;
}> {
  const [config, wallet, rechargeCount] = await Promise.all([
    prisma.platformConfig.findUnique({ where: { id: "default" } }),
    prisma.wallet.findUnique({ where: { userId } }),
    prisma.walletEntry.count({
      where: {
        type: "RECHARGE",
        wallet: { userId },
      },
    }),
  ]);

  const minBalanceLineMinor = config?.minBalanceLineMinor ?? 2000;
  const balanceMinor = wallet?.balanceMinor ?? 0;
  const hasRechargeHistory = rechargeCount > 0;
  const isGoldMember =
    hasRechargeHistory && balanceMinor >= minBalanceLineMinor;

  return {
    isGoldMember,
    balanceMinor,
    minBalanceLineMinor,
    hasRechargeHistory,
  };
}
