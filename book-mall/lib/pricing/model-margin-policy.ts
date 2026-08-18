/**
 * 模型系数 M 分档策略（单积分 v2）。
 *
 * 贵视频：对齐厂商公挂牌 M = max(listCost÷C, 1.25)（如 Seedance 1.4÷1.0=1.4）
 * 普通视频：videoMarginM（默认 1.5）
 * 生图 / LLM：分档见下
 */
import type { CreditCostUnit } from "@prisma/client";

import {
  DEFAULT_MARGIN_M,
  DEFAULT_VIDEO_MARGIN_M,
  isVideoBillingUnit,
} from "./credit-pricing-formulas";

/** 贵视频：净成本 ≥ ¥0.75/秒 */
export const EXPENSIVE_VIDEO_NET_COST_THRESHOLD = 0.75;
/** 贵生图：净成本 ≥ ¥0.15/张 → M=1.5 */
export const EXPENSIVE_IMAGE_NET_COST_THRESHOLD = 0.15;

/** 贵视频公挂牌对齐最低 M（年框后仍有毛利） */
export const VIDEO_PUBLIC_ALIGN_MIN_M = 1.25;
/** @deprecated 旧版贴成本 M=1.0；v2 用公挂牌对齐 */
export const VIDEO_MARGIN_M_EXPENSIVE = VIDEO_PUBLIC_ALIGN_MIN_M;
export const VIDEO_MARGIN_M_NORMAL = 1.5;
export const IMAGE_MARGIN_M_EXPENSIVE = 1.5;
export const IMAGE_MARGIN_M_CHEAP = 2.0;

export function resolveModelMarginM(input: {
  unit: CreditCostUnit | string;
  netCostYuan: number;
  /** 厂商公挂牌（元/计费单位），用于贵视频 M=list÷C */
  listCostYuan?: number;
  defaultMarginM?: number;
  videoMarginM?: number;
}): number {
  const net = input.netCostYuan;
  if (isVideoBillingUnit(input.unit)) {
    if (net >= EXPENSIVE_VIDEO_NET_COST_THRESHOLD) {
      const list = input.listCostYuan ?? 0;
      if (list > 0 && net > 0) {
        return Math.max(list / net, VIDEO_PUBLIC_ALIGN_MIN_M);
      }
      return VIDEO_PUBLIC_ALIGN_MIN_M;
    }
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
