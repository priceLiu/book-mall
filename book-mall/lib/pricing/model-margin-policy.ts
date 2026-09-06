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

/** 贵视频公挂牌对齐最低 M（年框后仍有毛利）@deprecated v3 不再按贵/便宜分档，M 统一由模型配置 marginM 控制 */
export const VIDEO_PUBLIC_ALIGN_MIN_M = 1.25;
/** @deprecated 旧版贴成本 M=1.0；v3 弃用 */
export const VIDEO_MARGIN_M_EXPENSIVE = VIDEO_PUBLIC_ALIGN_MIN_M;
export const VIDEO_MARGIN_M_NORMAL = 1.5;
/** @deprecated 旧版贵生图分档 */
export const IMAGE_MARGIN_M_EXPENSIVE = 1.5;
/** @deprecated 旧版便宜生图分档 */
export const IMAGE_MARGIN_M_CHEAP = 2.0;
/** 生图默认 M=1.5（与视频一致） */
export const IMAGE_MARGIN_M_NORMAL = 1.5;

export function resolveModelMarginM(input: {
  unit: CreditCostUnit | string;
  netCostYuan: number;
  /** 厂商公挂牌（元/计费单位），保留兼容 */
  listCostYuan?: number;
  /** 模型配置的 marginM（ModelCostProfile.marginM）；>0 时优先采用 */
  marginM?: number | null;
  defaultMarginM?: number;
  videoMarginM?: number;
}): number {
  // 优先采用模型配置的 marginM（管理员后台可调）
  if (input.marginM != null && input.marginM > 0) return input.marginM;
  // 视频：默认 1.5
  if (isVideoBillingUnit(input.unit)) {
    return VIDEO_MARGIN_M_NORMAL;
  }
  // 图片：默认 1.5
  if (input.unit === "PER_IMAGE") {
    return IMAGE_MARGIN_M_NORMAL;
  }
  // 文本/音频等：默认 1.0（不加价）
  return DEFAULT_MARGIN_M;
}

/** 按模型 M 推导锚定口径目标毛利（1 − 1/M，取整会有偏差）。 */
export function expectedAnchorMarginForM(marginM: number): number {
  if (!(marginM > 0)) return 0;
  return 1 - 1 / marginM;
}
