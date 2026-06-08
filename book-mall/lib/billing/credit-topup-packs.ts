/**
 * 积分加油包（加量包）— 固定三档，锚定 ¥0.04/积分。
 */
import { DEFAULT_CREDIT_ANCHOR_YUAN } from "@/lib/pricing/credit-pricing-formulas";

export interface CreditTopupPack {
  id: string;
  credits: number;
  priceYuan: number;
  label: string;
  /** 相对锚定价的折扣说明（展示用） */
  promo?: string;
}

export const CREDIT_TOPUP_PACKS: CreditTopupPack[] = [
  {
    id: "pack-1k",
    credits: 1000,
    priceYuan: 40,
    label: "轻量包",
  },
  {
    id: "pack-3k",
    credits: 3000,
    priceYuan: 108,
    label: "标准包",
    promo: "省10%",
  },
  {
    id: "pack-5k",
    credits: 5000,
    priceYuan: 170,
    label: "加量包",
    promo: "省15%",
  },
];

export function packById(id: string): CreditTopupPack | undefined {
  return CREDIT_TOPUP_PACKS.find((p) => p.id === id);
}

/** 锚定原价（未折扣），用于展示划线价 */
export function packListPriceYuan(credits: number, anchorYuan = DEFAULT_CREDIT_ANCHOR_YUAN): number {
  return Math.round(credits * anchorYuan * 100) / 100;
}
