import { fulfillWalletTopupCredits } from "@/lib/wallet-topup-fulfill";

/** 快捷档位（点，1 点 = ¥0.01） */
export const MOCK_TOPUP_PRESETS = [50_00, 100_00, 200_00, 500_00] as const;

export type MockTopupPresetPoints = (typeof MOCK_TOPUP_PRESETS)[number];

/** 允许提交的模拟充值点数：快捷档位，或 30～1000 元整对应点数 */
export type MockTopupAmountPoints = number;

export const MOCK_TOPUP_PRESET_WHITELIST = new Set<number>(MOCK_TOPUP_PRESETS);

/** 自定金额下限 / 上限（点），对应 30～1000 元整 */
export const MOCK_TOPUP_CUSTOM_MIN_POINTS = 30 * 100;
export const MOCK_TOPUP_CUSTOM_MAX_POINTS = 1000 * 100;

export const DEFAULT_MOCK_TOPUP_AMOUNT_POINTS = 100_00;

export function isAllowedMockTopupAmountPoints(n: number): boolean {
  if (!Number.isInteger(n) || n <= 0) return false;
  if (MOCK_TOPUP_PRESET_WHITELIST.has(n)) return true;
  if (n % 100 !== 0) return false;
  return n >= MOCK_TOPUP_CUSTOM_MIN_POINTS && n <= MOCK_TOPUP_CUSTOM_MAX_POINTS;
}

export function normalizeMockTopupAmountPoints(raw: unknown): number {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 10)
        : NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return DEFAULT_MOCK_TOPUP_AMOUNT_POINTS;
  }
  if (isAllowedMockTopupAmountPoints(n)) {
    return n;
  }
  return DEFAULT_MOCK_TOPUP_AMOUNT_POINTS;
}

export type ApplyMockWalletTopupOptions = {
  /** 须先在个人中心领取；与实付档位一致时在入账事务内核销 */
  rechargeCouponId?: string;
};

/**
 * 模拟充值到账。内部统一走 `fulfillWalletTopupCredits`（与真实支付入账路径对齐）。
 * 充送仅通过「已领取的充值优惠券」核销生效。
 */
export async function applyMockWalletTopup(
  userId: string,
  paidAmountPoints: number,
  options?: ApplyMockWalletTopupOptions,
): Promise<{
  orderId: string;
  balanceAfterPoints: number;
  creditedTotalPoints: number;
}> {
  if (!isAllowedMockTopupAmountPoints(paidAmountPoints)) {
    throw new Error("充值金额不在允许范围内（快捷档位或 30～1000 元整数）");
  }

  return fulfillWalletTopupCredits({
    userId,
    paidAmountPoints,
    rechargeCouponId: options?.rechargeCouponId?.trim() || undefined,
    meta: { mock: true },
  });
}
