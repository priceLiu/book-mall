/** 与 book-mall/lib/pricing/unified-credit-formula.ts 结构对齐（finance-web 仅类型） */

export interface ModelQuoteRow {
  canonicalModelKey: string;
  vendor: string;
  displayName: string;
  unit: string;
  listCostYuan: number;
  discountRate: number;
  netCostYuan: number;
  marginM: number;
  listPriceYuan: number;
  creditsPerUnit: number;
  baseMarginRate: number;
  marginOk: boolean;
  minGuard: number;
  chargeCredits15s: number | null;
  netCost15s: number | null;
}

export interface SkuMarginRow {
  skuId: string;
  label: string;
  channel: "SUBSCRIPTION" | "TOPUP" | "API";
  priceYuan: number;
  credits: number;
  pricePerCreditYuan: number;
  chargeCredits: number;
  netCostYuan: number;
  revenueYuan: number;
  marginRate: number;
  marginOk: boolean;
  maxGenerations: number;
}

export interface UnifiedFormulaSimulation {
  version: number;
  config: {
    creditAnchorYuan: number;
    defaultMarginM: number;
    minMarginGuard: number;
    defaultVideoSec: number;
    videoMarginM: number;
    videoMinMarginGuard: number;
  };
  formulaLines: readonly string[];
  models: ModelQuoteRow[];
  subscriptionSkus: SkuMarginRow[];
  topupSkus: SkuMarginRow[];
  apiSkus: SkuMarginRow[];
  anchorModelKey: string;
}
