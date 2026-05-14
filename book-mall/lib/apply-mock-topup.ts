import { prisma } from "@/lib/prisma";

/** 快捷档位（分） */
export const MOCK_TOPUP_PRESETS = [50_00, 100_00, 200_00, 500_00] as const;

export type MockTopupPresetMinor = (typeof MOCK_TOPUP_PRESETS)[number];

/** 允许提交的模拟充值金额（分）：快捷档位，或 30～1000 元整数 */
export type MockTopupAmountMinor = number;

export const MOCK_TOPUP_PRESET_WHITELIST = new Set<number>(MOCK_TOPUP_PRESETS);

/** 自定金额下限 / 上限（分），对应 30～1000 元整 */
export const MOCK_TOPUP_CUSTOM_MIN_MINOR = 30 * 100;
export const MOCK_TOPUP_CUSTOM_MAX_MINOR = 1000 * 100;

export const DEFAULT_MOCK_TOPUP_AMOUNT_MINOR = 100_00;

export function isAllowedMockTopupAmountMinor(n: number): boolean {
  if (!Number.isInteger(n) || n <= 0) return false;
  if (MOCK_TOPUP_PRESET_WHITELIST.has(n)) return true;
  if (n % 100 !== 0) return false;
  return n >= MOCK_TOPUP_CUSTOM_MIN_MINOR && n <= MOCK_TOPUP_CUSTOM_MAX_MINOR;
}

export function normalizeMockTopupAmountMinor(raw: unknown): number {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 10)
        : NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return DEFAULT_MOCK_TOPUP_AMOUNT_MINOR;
  }
  if (isAllowedMockTopupAmountMinor(n)) {
    return n;
  }
  return DEFAULT_MOCK_TOPUP_AMOUNT_MINOR;
}

/** 模拟充值到账：订单 + 钱包流水 */
export async function applyMockWalletTopup(
  userId: string,
  amountMinor: number,
): Promise<{ orderId: string; balanceAfterMinor: number }> {
  if (!isAllowedMockTopupAmountMinor(amountMinor)) {
    throw new Error("充值金额不在允许范围内（快捷档位或 30～1000 元整数）");
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
