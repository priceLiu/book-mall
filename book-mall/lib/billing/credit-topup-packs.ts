/**
 * 积分加油包（加量包）— 通用池固定三档 + 视频专项池三档，锚定 ¥0.04/积分。
 */
import type { CreditPool } from "@prisma/client";

import { DEFAULT_CREDIT_ANCHOR_YUAN } from "@/lib/pricing/credit-pricing-formulas";

export interface CreditTopupPack {
  id: string;
  credits: number;
  priceYuan: number;
  label: string;
  pool: CreditPool;
  /** 相对锚定价的折扣说明（展示用） */
  promo?: string;
}

export const CREDIT_TOPUP_PACKS: CreditTopupPack[] = [
  {
    id: "pack-1k",
    credits: 1000,
    priceYuan: 40,
    label: "轻量包",
    pool: "GENERAL",
  },
  {
    id: "pack-3k",
    credits: 3000,
    priceYuan: 108,
    label: "标准包",
    pool: "GENERAL",
    promo: "省10%",
  },
  {
    id: "pack-5k",
    credits: 5000,
    priceYuan: 170,
    label: "加量包",
    pool: "GENERAL",
    promo: "省15%",
  },
];

/** 视频专项池独立充值包（不占用套餐月积分）。 */
export const VIDEO_CREDIT_TOPUP_PACKS: CreditTopupPack[] = [
  {
    id: "video-pack-500",
    credits: 500,
    priceYuan: 22,
    label: "视频轻量包",
    pool: "VIDEO",
  },
  {
    id: "video-pack-1500",
    credits: 1500,
    priceYuan: 58,
    label: "视频标准包",
    pool: "VIDEO",
    promo: "省13%",
  },
  {
    id: "video-pack-3000",
    credits: 3000,
    priceYuan: 108,
    label: "视频加量包",
    pool: "VIDEO",
    promo: "省10%",
  },
];

export const ALL_CREDIT_TOPUP_PACKS: CreditTopupPack[] = [
  ...CREDIT_TOPUP_PACKS,
  ...VIDEO_CREDIT_TOPUP_PACKS,
];

export function packById(id: string): CreditTopupPack | undefined {
  return ALL_CREDIT_TOPUP_PACKS.find((p) => p.id === id);
}

/** 锚定原价（未折扣），用于展示划线价 */
export function packListPriceYuan(credits: number, anchorYuan = DEFAULT_CREDIT_ANCHOR_YUAN): number {
  return Math.round(credits * anchorYuan * 100) / 100;
}
