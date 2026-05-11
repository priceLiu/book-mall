import { prisma } from "@/lib/prisma";

/** 允许的模拟充值档位（分） */
export const MOCK_TOPUP_PRESETS = [50_00, 100_00, 200_00] as const;

export type MockTopupAmountMinor = (typeof MOCK_TOPUP_PRESETS)[number];

export const MOCK_TOPUP_AMOUNT_MINOR_WHITELIST = new Set<number>(MOCK_TOPUP_PRESETS);

/** 默认模拟充值 ¥100（分） */
export const DEFAULT_MOCK_TOPUP_AMOUNT_MINOR: MockTopupAmountMinor = 100_00;

export function normalizeMockTopupAmountMinor(raw: unknown): MockTopupAmountMinor {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 10)
        : NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return DEFAULT_MOCK_TOPUP_AMOUNT_MINOR;
  }
  return MOCK_TOPUP_AMOUNT_MINOR_WHITELIST.has(n)
    ? (n as MockTopupAmountMinor)
    : DEFAULT_MOCK_TOPUP_AMOUNT_MINOR;
}

/** 模拟充值到账：订单 + 钱包流水 */
export async function applyMockWalletTopup(
  userId: string,
  amountMinor: MockTopupAmountMinor,
): Promise<{ orderId: string; balanceAfterMinor: number }> {
  if (!MOCK_TOPUP_AMOUNT_MINOR_WHITELIST.has(amountMinor)) {
    throw new Error("充值金额不在允许的模拟档位内");
  }

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUniqueOrThrow({
      where: { userId },
    });
    const next = wallet.balanceMinor + amountMinor;
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceMinor: next },
    });
    const order = await tx.order.create({
      data: {
        userId,
        type: "WALLET_TOPUP",
        status: "PAID",
        amountMinor,
        paidAt: new Date(),
        meta: { mock: true },
      },
    });
    await tx.walletEntry.create({
      data: {
        walletId: wallet.id,
        type: "RECHARGE",
        amountMinor,
        balanceAfterMinor: next,
        description: `模拟充值 ¥${(amountMinor / 100).toFixed(2)}`,
        orderId: order.id,
      },
    });
    return { orderId: order.id, balanceAfterMinor: next };
  });
}
