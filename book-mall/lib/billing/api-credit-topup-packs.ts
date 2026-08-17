/**
 * API 会员充值档位（展示 / Checkout 用；首版仅报价页展示，履约待 API 身份上线）。
 */
export interface ApiCreditTopupPack {
  id: string;
  credits: number;
  priceYuan: number;
  label: string;
  promo?: string;
}

export const API_CREDIT_TOPUP_PACKS: ApiCreditTopupPack[] = [
  { id: "api-pack-38", credits: 1050, priceYuan: 38, label: "入门充值" },
  { id: "api-pack-188", credits: 5250, priceYuan: 188, label: "标准充值" },
  {
    id: "api-pack-368",
    credits: 10500,
    priceYuan: 368,
    label: "加量充值",
    promo: "省 5%",
  },
  { id: "api-pack-1888", credits: 55000, priceYuan: 1888, label: "专业充值" },
  {
    id: "api-pack-4688",
    credits: 140000,
    priceYuan: 4688,
    label: "企业充值",
    promo: "省 10%",
  },
];
