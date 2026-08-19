/**
 * 订阅套餐亮点 · 可生成次数估算（锚定模型，与 unified-credit-formula 一致）。
 * 视频按财务 2.0：每条 = 15 秒（封顶计费秒数）。
 */
import type { CreditCostUnit } from "@prisma/client";

import {
  computeTierGenerations,
  computeUnifiedChargeCredits,
  DEFAULT_VIDEO_SEC,
} from "./credit-pricing-formulas";

export type PricingHighlightModelPrice = {
  canonicalModelKey: string;
  displayName: string;
  unit: CreditCostUnit | string;
  creditsPerUnit: number;
};

/** 锚定视频：Seedance 2.0 720P（15s = 525 积分） */
const ANCHOR_VIDEO_KEYS = [
  "seedance-2.0-720p-real",
  "seedance-2.0",
  "bytedance/seedance-2",
] as const;

/** 锚定生图：通义万相示意（非最便宜 nano 档） */
const ANCHOR_IMAGE_KEYS = ["wanxiang-image", "wan2.7-image", "wanxiang-i2i"] as const;

export function findPricingAnchorModel(
  models: PricingHighlightModelPrice[],
  unit: "PER_IMAGE" | "PER_SEC",
  preferredKeys: readonly string[],
): PricingHighlightModelPrice | null {
  for (const key of preferredKeys) {
    const hit = models.find((m) => m.unit === unit && m.canonicalModelKey === key);
    if (hit) return hit;
  }
  const unitModels = models.filter((m) => m.unit === unit && m.creditsPerUnit > 0);
  if (unitModels.length === 0) return null;
  for (const key of preferredKeys) {
    const stem = key.split("-")[0];
    const hit = unitModels.find((m) => m.canonicalModelKey.includes(stem));
    if (hit) return hit;
  }
  return unitModels.sort((a, b) => a.creditsPerUnit - b.creditsPerUnit)[0];
}

/** 会员积分每 31 天刷新；年付套餐在库内为 12 期合计，展示/估算用单期额度。 */
export function resolveMembershipPeriodCredits(
  creditsInPlan: number,
  interval: "MONTH" | "YEAR" | string,
): number {
  if (interval === "YEAR") return Math.round(creditsInPlan / 12);
  return creditsInPlan;
}

export function computePricingHighlightEstimate(
  creditsPool: number,
  models: PricingHighlightModelPrice[],
  videoSec = DEFAULT_VIDEO_SEC,
): {
  maxImages: number;
  maxVideos15s: number;
  imageCreditsPerUnit: number;
  videoCreditsPer15s: number;
  imageAnchorLabel: string;
  videoAnchorLabel: string;
} {
  const imageModel = findPricingAnchorModel(models, "PER_IMAGE", ANCHOR_IMAGE_KEYS);
  const videoModel = findPricingAnchorModel(models, "PER_SEC", ANCHOR_VIDEO_KEYS);

  const imageCreditsPerUnit = imageModel?.creditsPerUnit ?? 0;
  const videoCreditsPer15s =
    videoModel != null
      ? computeUnifiedChargeCredits({
          creditsPerUnit: videoModel.creditsPerUnit,
          units: videoSec,
        })
      : 0;

  return {
    maxImages: computeTierGenerations(creditsPool, imageCreditsPerUnit),
    maxVideos15s: computeTierGenerations(creditsPool, videoCreditsPer15s),
    imageCreditsPerUnit,
    videoCreditsPer15s,
    imageAnchorLabel: imageModel?.displayName ?? "标准生图",
    videoAnchorLabel: videoModel?.displayName ?? "标准 15 秒视频",
  };
}
