/**
 * 积分加油包 — 三档整数积分，ppc 拉开且不低于至尊 0.04。
 */
import { DEFAULT_CREDIT_ANCHOR_YUAN } from "@/lib/pricing/credit-pricing-formulas";

export interface CreditTopupPack {
  id: string;
  credits: number;
  priceYuan: number;
  label: string;
  /** 相对锚定价的折扣说明（展示用） */
  promo?: string;
  /** 仅平台管理员可见/可购 */
  adminOnly?: boolean;
  /** 购买前须验证注册手机号 + 短信验证码 */
  requirePhoneVerify?: boolean;
}

export const CREDIT_TOPUP_PACKS: CreditTopupPack[] = [
  {
    id: "pack-light",
    credits: 1000,
    priceYuan: 80,
    label: "轻量积分包",
  },
  {
    id: "pack-standard",
    credits: 2500,
    priceYuan: 163,
    label: "标准包",
    promo: "更划算",
  },
  {
    id: "pack-plus",
    credits: 6000,
    priceYuan: 300,
    label: "加量包",
    promo: "单价最低",
  },
];

/** 管理员专用 · 测试充值（须短信验证 + 企业微信支付）。 */
export const ADMIN_VIDEO_TOPUP_PACK: CreditTopupPack = {
  id: "video-pack-admin-5000",
  credits: 5000,
  priceYuan: 0.01,
  label: "管理员专用包",
  adminOnly: true,
  requirePhoneVerify: true,
};

export const ALL_CREDIT_TOPUP_PACKS: CreditTopupPack[] = [
  ...CREDIT_TOPUP_PACKS,
  ADMIN_VIDEO_TOPUP_PACK,
];

export function packById(id: string): CreditTopupPack | undefined {
  return ALL_CREDIT_TOPUP_PACKS.find((p) => p.id === id);
}

export function isAdminOnlyTopupPack(pack: CreditTopupPack | undefined): boolean {
  return pack?.adminOnly === true;
}

/** 锚定原价（未折扣），用于展示划线价 */
export function packListPriceYuan(credits: number, anchorYuan = DEFAULT_CREDIT_ANCHOR_YUAN): number {
  return Math.round(credits * anchorYuan * 100) / 100;
}
