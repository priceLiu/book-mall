/**
 * 订阅套餐亮点 · 可生成次数估算（展示用低成本锚定）。
 *
 * 与财务毛利护栏锚定（Seedance 2.0）分离：定价页只展示「平台内主流低成本模型」换算，
 * 让用户感知可生成次数；视频仍按 15 秒/条封顶计费。
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

/** 展示锚定：非 Seedance 的主流低成本视频（同价时优先） */
const PREFERRED_CHEAP_VIDEO_KEYS = [
  "wanxiang-video-2.6",
  "wanxiang-video-2.7",
  "wanxiang-video-2.7-i2v",
  "grok-imagine/image-to-video",
  "happyhorse-r2v",
  "wanxiang-i2v",
] as const;

/** 展示锚定：主流低成本生图（同价时优先） */
const PREFERRED_CHEAP_IMAGE_KEYS = [
  "lib-nano-pro-1k",
  "lib-nano-pro-2k",
  "grok-imagine/text-to-image",
  "gpt-image-1",
  "wanxiang-image",
] as const;

/** 不计入「最多可生成」的生视频类（贵锚定 / 工具 / 非标准生成） */
const HIGHLIGHT_VIDEO_EXCLUDE_RE =
  /seedance|topaz|upscale|motion-control|video-to-video|regeneration|h3-regeneration|asr|tts|speech/i;

/** 不计入的生图类（试衣解析 / 语音 / 非出图） */
const HIGHLIGHT_IMAGE_EXCLUDE_RE =
  /parsing|speech|tts|suno|eleven|aitryon|tryon|vl-|vision|kie-suno|music-/i;

function isEligibleHighlightModel(
  model: PricingHighlightModelPrice,
  unit: "PER_IMAGE" | "PER_SEC",
  excludeRe: RegExp,
): boolean {
  if (model.unit !== unit || model.creditsPerUnit <= 0) return false;
  const hay = `${model.canonicalModelKey} ${model.displayName}`;
  return !excludeRe.test(hay);
}

/**
 * 在已上架报价中取最低 creditsPerUnit；同价时优先 preferredKeys。
 */
export function findCheapestHighlightModel(
  models: PricingHighlightModelPrice[],
  unit: "PER_IMAGE" | "PER_SEC",
  excludeRe: RegExp,
  preferredKeys: readonly string[],
): PricingHighlightModelPrice | null {
  const eligible = models.filter((m) => isEligibleHighlightModel(m, unit, excludeRe));
  if (eligible.length === 0) return null;

  const minCpu = Math.min(...eligible.map((m) => m.creditsPerUnit));
  const tied = eligible.filter((m) => m.creditsPerUnit === minCpu);

  for (const key of preferredKeys) {
    const hit = tied.find(
      (m) => m.canonicalModelKey === key || m.canonicalModelKey.includes(key),
    );
    if (hit) return hit;
  }
  return tied.sort((a, b) => a.canonicalModelKey.localeCompare(b.canonicalModelKey))[0];
}

/** @deprecated 保留导出名，内部走低价锚定 */
export function findPricingAnchorModel(
  models: PricingHighlightModelPrice[],
  unit: "PER_IMAGE" | "PER_SEC",
  _preferredKeys: readonly string[],
): PricingHighlightModelPrice | null {
  void _preferredKeys;
  return findCheapestHighlightModel(
    models,
    unit,
    unit === "PER_SEC" ? HIGHLIGHT_VIDEO_EXCLUDE_RE : HIGHLIGHT_IMAGE_EXCLUDE_RE,
    unit === "PER_SEC" ? PREFERRED_CHEAP_VIDEO_KEYS : PREFERRED_CHEAP_IMAGE_KEYS,
  );
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
  const imageModel = findCheapestHighlightModel(
    models,
    "PER_IMAGE",
    HIGHLIGHT_IMAGE_EXCLUDE_RE,
    PREFERRED_CHEAP_IMAGE_KEYS,
  );
  const videoModel = findCheapestHighlightModel(
    models,
    "PER_SEC",
    HIGHLIGHT_VIDEO_EXCLUDE_RE,
    PREFERRED_CHEAP_VIDEO_KEYS,
  );

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
    imageAnchorLabel: imageModel?.displayName ?? "低成本生图",
    videoAnchorLabel: videoModel?.displayName ?? "低成本 15 秒视频",
  };
}
