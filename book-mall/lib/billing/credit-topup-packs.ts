/**
 * 积分加油包（加量包）— 三档，锚定 ¥0.04/积分。
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
    credits: 1500,
    priceYuan: 62,
    label: "轻量积分包",
  },
  {
    id: "pack-standard",
    credits: 4000,
    priceYuan: 160,
    label: "标准包",
    promo: "省10%",
  },
  {
    id: "pack-plus",
    credits: 8000,
    priceYuan: 304,
    label: "加量包",
    promo: "省15%",
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
