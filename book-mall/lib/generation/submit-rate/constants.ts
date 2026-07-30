import type { GenerationSubmitTier } from "@prisma/client";

export const SUBMIT_WINDOW_SEC = 10;
export const SUBMIT_BURST_STANDARD = 10;
export const SUBMIT_BURST_ELEVATED = 15;
export const SUBMIT_BURST_HEAVY_DEFAULT = 25;

export const GENERATION_SUBMIT_TIER_LABEL: Record<GenerationSubmitTier, string> = {
  STANDARD: "普通",
  ELEVATED: "中度",
  HEAVY: "重度",
};

export type SubmitQuotaTierRow = {
  tier: GenerationSubmitTier;
  label: string;
  burstLimit: number;
  description: string;
};

/** 价格公示 / 管理后台共用的三档说明行 */
export function getSubmitQuotaTierRows(): SubmitQuotaTierRow[] {
  return [
    {
      tier: "STANDARD",
      label: GENERATION_SUBMIT_TIER_LABEL.STANDARD,
      burstLimit: SUBMIT_BURST_STANDARD,
      description: "默认档位，适用于大多数个人与团队空间。",
    },
    {
      tier: "ELEVATED",
      label: GENERATION_SUBMIT_TIER_LABEL.ELEVATED,
      burstLimit: SUBMIT_BURST_ELEVATED,
      description: "较高短时提交上限，适用于平台管理员或经运营核定的账号。",
    },
    {
      tier: "HEAVY",
      label: GENERATION_SUBMIT_TIER_LABEL.HEAVY,
      burstLimit: SUBMIT_BURST_HEAVY_DEFAULT,
      description: "由平台单独核定 burst 上限，可按业务需要上调。",
    },
  ];
}

export function burstLimitForTier(
  tier: GenerationSubmitTier,
  burstOverride?: number | null,
): number {
  if (tier === "HEAVY") {
    return burstOverride && burstOverride > 0
      ? burstOverride
      : SUBMIT_BURST_HEAVY_DEFAULT;
  }
  if (tier === "ELEVATED") return SUBMIT_BURST_ELEVATED;
  return SUBMIT_BURST_STANDARD;
}
