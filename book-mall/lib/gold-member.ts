import { prisma } from "@/lib/prisma";

/**
 * 「黄金会员」——独立 AI 工具站准入（与站内「订阅 + 最低余额」的高级计量权益区分）。
 *
 * 条件（须同时满足）：
 * 1. 至少有一条钱包流水类型为 RECHARGE（历史上完成过充值入账）；
 * 2. 当前可用余额 ≥ 平台配置的最低余额线（默认 2000 点 = ¥20）。
 */
export async function getGoldMemberAccess(userId: string): Promise<{
  isGoldMember: boolean;
  balancePoints: number;
  minBalanceLinePoints: number;
  hasRechargeHistory: boolean;
}> {
  /** 单连接顺序执行，降低与 introspect 等路由叠加时的连接池峰值（wall-clock 略增通常可接受） */
  const [config, wallet, rechargeCount] = await prisma.$transaction([
    prisma.platformConfig.findUnique({ where: { id: "default" } }),
    prisma.wallet.findUnique({ where: { userId } }),
    prisma.walletEntry.count({
      where: {
        type: "RECHARGE",
        wallet: { userId },
      },
    }),
  ]);

  const minBalanceLinePoints = config?.minBalanceLinePoints ?? 2000;
  const balancePoints = wallet?.balancePoints ?? 0;
  const hasRechargeHistory = rechargeCount > 0;
  const isGoldMember =
    hasRechargeHistory && balancePoints >= minBalanceLinePoints;

  return {
    isGoldMember,
    balancePoints,
    minBalanceLinePoints,
    hasRechargeHistory,
  };
}
