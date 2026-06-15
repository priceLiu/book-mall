/**
 * 模型系数 M 分档策略（定价 1.5 方案）。
 *
 * 视频：净成本 ≥ 阈值 → M=1.0（贴成本）；否则 M=1.5
 * 生图：净成本 ≥ 阈值 → M=1.5；否则 M=2.0
 * LLM 等：沿用 defaultMarginM（默认 2.5）
 */
import type { CreditCostUnit } from "@prisma/client";

import {
  DEFAULT_MARGIN_M,
  DEFAULT_VIDEO_MARGIN_M,
  isVideoBillingUnit,
} from "./credit-pricing-formulas";

/** 贵视频：净成本 ≥ ¥0.75/秒 → M=1.0 */
export const EXPENSIVE_VIDEO_NET_COST_THRESHOLD = 0.75;
/** 贵生图：净成本 ≥ ¥0.15/张 → M=1.5 */
export const EXPENSIVE_IMAGE_NET_COST_THRESHOLD = 0.15;

export const VIDEO_MARGIN_M_EXPENSIVE = 1.0;
export const VIDEO_MARGIN_M_NORMAL = 1.5;
export const IMAGE_MARGIN_M_EXPENSIVE = 1.5;
export const IMAGE_MARGIN_M_CHEAP = 2.0;

export function resolveModelMarginM(input: {
  unit: CreditCostUnit | string;
  netCostYuan: number;
  defaultMarginM?: number;
  videoMarginM?: number;
}): number {
  const net = input.netCostYuan;
  if (isVideoBillingUnit(input.unit)) {
    if (net >= EXPENSIVE_VIDEO_NET_COST_THRESHOLD) return VIDEO_MARGIN_M_EXPENSIVE;
    return input.videoMarginM ?? DEFAULT_VIDEO_MARGIN_M;
  }
  if (input.unit === "PER_IMAGE") {
    if (net >= EXPENSIVE_IMAGE_NET_COST_THRESHOLD) return IMAGE_MARGIN_M_EXPENSIVE;
    return IMAGE_MARGIN_M_CHEAP;
  }
  return input.defaultMarginM ?? DEFAULT_MARGIN_M;
}

/** 按模型 M 推导锚定口径目标毛利（1 − 1/M，取整会有偏差）。 */
export function expectedAnchorMarginForM(marginM: number): number {
  if (!(marginM > 0)) return 0;
  return 1 - 1 / marginM;
}
