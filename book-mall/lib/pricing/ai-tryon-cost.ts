/**
 * 阿里云百炼 · AI 试衣挂牌成本（B）与阶梯解析。
 * 真源：tool-web/doc/price_0518.md；需求 doc/product/11-ai-tryon-cost-template-v1.0.md
 */

/** 成本模板标识（可扩展多云厂商） */
export const COST_TEMPLATE_ALIYUN_FLAT_PER_IMAGE_V1 = "aliyun.flat_per_image_v1" as const;
export const COST_TEMPLATE_ALIYUN_AI_TRYON_PARSING_INPUT_V1 =
  "aliyun.ai_tryon_parsing_input_v1" as const;
export const COST_TEMPLATE_ALIYUN_AI_TRYON_REFINER_VOLUME_TIER_V1 =
  "aliyun.ai_tryon_refiner_volume_tier_v1" as const;

export const AI_TRYON_MODEL_KEYS = [
  "aitryon",
  "aitryon-plus",
  "aitryon-parsing-v1",
  "aitryon-refiner",
] as const;

export type AiTryonModelKey = (typeof AI_TRYON_MODEL_KEYS)[number];

/** 试衣子模型 → 账单/流水可读名 */
export const AI_TRYON_MODEL_LABEL: Record<AiTryonModelKey, string> = {
  aitryon: "AI试衣",
  "aitryon-plus": "AI试衣 Plus",
  "aitryon-parsing-v1": "AI试衣·图片分割",
  "aitryon-refiner": "AI试衣·精修",
};

export function aiTryonModelLabel(key: string | null | undefined): string | null {
  if (!key?.trim()) return null;
  if (isAiTryonModelKey(key)) return AI_TRYON_MODEL_LABEL[key];
  return key.trim();
}

export function isAiTryonModelKey(key: string | null | undefined): key is AiTryonModelKey {
  if (!key) return false;
  return (AI_TRYON_MODEL_KEYS as readonly string[]).includes(key);
}

/** aitryon-refiner：按账期内第 N 张输出图所在阶梯取单价（元/张）。 */
export const REFINER_VOLUME_TIERS = [
  { tierRaw: "生成≤25张", maxOrdinal: 25, costYuan: 0.3 },
  { tierRaw: "25<生成≤125张", maxOrdinal: 125, costYuan: 0.275 },
  { tierRaw: "125<生成≤250张", maxOrdinal: 250, costYuan: 0.25 },
  { tierRaw: "250<生成≤1250张", maxOrdinal: 1250, costYuan: 0.225 },
  { tierRaw: "1250<生成≤2500张", maxOrdinal: 2500, costYuan: 0.2 },
  { tierRaw: "2500<生成≤2.5万张", maxOrdinal: 25_000, costYuan: 0.175 },
  { tierRaw: ">2.5万张", maxOrdinal: Number.POSITIVE_INFINITY, costYuan: 0.15 },
] as const;

export function pickRefinerTierByOrdinal(ordinal: number): (typeof REFINER_VOLUME_TIERS)[number] {
  const n = Math.max(1, Math.floor(ordinal));
  for (const t of REFINER_VOLUME_TIERS) {
    if (n <= t.maxOrdinal) return t;
  }
  return REFINER_VOLUME_TIERS[REFINER_VOLUME_TIERS.length - 1]!;
}

/** UTC 自然月账期键 */
export function usagePeriodKeyUtcMonth(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function costTemplateKeyForModel(modelKey: string): string {
  if (modelKey === "aitryon-parsing-v1") return COST_TEMPLATE_ALIYUN_AI_TRYON_PARSING_INPUT_V1;
  if (modelKey === "aitryon-refiner") return COST_TEMPLATE_ALIYUN_AI_TRYON_REFINER_VOLUME_TIER_V1;
  if (isAiTryonModelKey(modelKey)) return COST_TEMPLATE_ALIYUN_FLAT_PER_IMAGE_V1;
  return COST_TEMPLATE_ALIYUN_FLAT_PER_IMAGE_V1;
}
