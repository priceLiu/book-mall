/**
 * DeepSeek V4 官方挂牌价（峰值 · USD/百万 Token → 元/千 Token）。
 * 来源：https://api-docs.deepseek.com/quick_start/pricing/
 *
 * DeepSeek 控制台账单 `price` 列为 元/token（与 USD 峰值近似 1:1 计费）；
 * 积分报价取峰值 cache-miss 输入 + 峰值输出，留毛利空间。
 */
import { ktokenFromMillion } from "@/lib/finance/missing-model-cost-seeds";

export const DEEPSEEK_PRICING_DOC_URL =
  "https://api-docs.deepseek.com/quick_start/pricing/";

/** USD / 1M tokens（峰值 Peak）→ 元/千 token */
export function deepseekKtokenFromUsdPerMillion(usdPerMillion: number): number {
  return ktokenFromMillion(usdPerMillion);
}

export type DeepseekV4PriceRow = {
  canonicalModelKey: string;
  gatewayModelKeys: string[];
  displayName: string;
  /** 输入 cache-miss · 元/千 token */
  inputListCostYuan: number;
  /** 输出 · 元/千 token */
  outputListCostYuan: number;
  note: string;
};

/** 峰值 USD/M：flash cache-miss 0.44 / output 1.32；pro cache-miss 1.32 / output 3.96 */
export const DEEPSEEK_V4_LIST_PRICES: DeepseekV4PriceRow[] = [
  {
    canonicalModelKey: "deepseek-v4-flash",
    gatewayModelKeys: ["deepseek-v4-flash", "deepseek-chat", "deepseek-reasoner"],
    displayName: "DeepSeek V4 Flash",
    inputListCostYuan: deepseekKtokenFromUsdPerMillion(0.44),
    outputListCostYuan: deepseekKtokenFromUsdPerMillion(1.32),
    note: "peak cache-miss in + peak out · doc 2026-08",
  },
  {
    canonicalModelKey: "deepseek-v4-pro",
    gatewayModelKeys: ["deepseek-v4-pro"],
    displayName: "DeepSeek V4 Pro",
    inputListCostYuan: deepseekKtokenFromUsdPerMillion(1.32),
    outputListCostYuan: deepseekKtokenFromUsdPerMillion(3.96),
    note: "peak cache-miss in + peak out · doc 2026-08",
  },
  {
    canonicalModelKey: "deepseek-v4-flash-vision-exp",
    gatewayModelKeys: ["deepseek-v4-flash-vision-exp"],
    displayName: "DeepSeek V4 Flash Vision",
    inputListCostYuan: deepseekKtokenFromUsdPerMillion(0.44),
    outputListCostYuan: deepseekKtokenFromUsdPerMillion(1.32),
    note: "同 flash 峰值 · 含图像 token",
  },
];

/** 兼容旧档 deepseek-chat → 与 v4-flash 同价 */
export const DEEPSEEK_LEGACY_CHAT_ALIASES = ["deepseek-chat"] as const;

/** 对账 joinKey：deepseek-chat / deepseek-reasoner → deepseek-v4-flash */
export function resolveDeepseekReconciliationModelKey(modelKey: string): string {
  return findDeepseekListPrice(modelKey)?.canonicalModelKey ?? modelKey.trim();
}

export function findDeepseekListPrice(modelKey: string): DeepseekV4PriceRow | null {
  const k = modelKey.trim().toLowerCase();
  for (const row of DEEPSEEK_V4_LIST_PRICES) {
    if (row.canonicalModelKey.toLowerCase() === k) return row;
    if (row.gatewayModelKeys.some((g) => g.toLowerCase() === k)) return row;
  }
  if (DEEPSEEK_LEGACY_CHAT_ALIASES.some((a) => a === k)) {
    return DEEPSEEK_V4_LIST_PRICES.find((r) => r.canonicalModelKey === "deepseek-v4-flash") ?? null;
  }
  return null;
}
