/**
 * 单积分 · 统一计价公式（v2）
 *
 * 全站同一模型扣分相同；价差仅在积分购入单价（订阅档 / 轻量包 / API 充值）。
 * 财务后台「积分报价计算器」与 Gateway 扣费、Dock 预览共用本模块。
 */
import type { CreditCostUnit } from "@prisma/client";

import {
  computeCreditPrice,
  computeEffectiveMargin,
  computeNetCost,
  computePricePerCredit,
  computeUnifiedChargeCredits,
  DEFAULT_CREDIT_ANCHOR_YUAN,
  DEFAULT_MIN_MARGIN_GUARD,
  DEFAULT_VIDEO_MIN_MARGIN_GUARD,
  marginGuardForUnit,
  marginPassesGuard,
  type PricingConfig,
  round4,
  videoBillableSeconds,
} from "./credit-pricing-formulas";
import { resolveModelMarginM } from "./model-margin-policy";

export const UNIFIED_CREDIT_FORMULA_VERSION = 2;

/** 对外展示用公式说明（财务后台） */
export const UNIFIED_CREDIT_FORMULA_LINES = [
  "C = listCost × (1 − discountRate)     // 年框/渠道后净成本（元/计费单位）",
  "M = resolveModelMarginM(unit, C, listCost)   // 贵视频对齐公挂牌：max(list÷C, 1.25)",
  "P = C × M                               // 对用户挂牌价（元/计费单位）",
  "U₀ = round(P ÷ anchor)                  // 挂牌积分/单位（人人相同，≥1）",
  "扣减积分 = U₀ × units                   // units：视频秒数封顶、张数、千 token…",
  "ppc = 售价 ÷ 到账积分                   // 购入单价（订阅月发 / 轻量包 / API 充值）",
  "实收(元) = 扣减积分 × ppc",
  "毛利 g = 1 − C_total ÷ 实收            // C_total = 单位净成本 × units",
  "ppc_max = C_total ÷ (扣减积分 × (1 − m_min))   // SKU 定价护栏",
] as const;

export interface ReferenceVendorModel {
  id: string;
  vendor: string;
  displayName: string;
  unit: CreditCostUnit;
  listCostYuan: number;
  discountRate: number;
  tierRaw?: string;
  note?: string;
}

/** 多厂商参考模型（测算用；真源仍以 ModelCostProfile 为准） */
export const REFERENCE_VENDOR_MODELS: ReferenceVendorModel[] = [
  {
    id: "seedance-2.0-720p-real",
    vendor: "volcengine",
    displayName: "Seedance 2.0 · 720P",
    unit: "PER_SEC",
    listCostYuan: 1.4,
    discountRate: 0.2857,
    tierRaw: "720P",
    note: "公挂牌 1.4元/秒；年框保底后净成本约 1.0元/秒",
  },
  {
    id: "happyhorse-r2v",
    vendor: "aliyun",
    displayName: "HappyHorse R2V",
    unit: "PER_SEC",
    listCostYuan: 0.9,
    discountRate: 0.1,
    tierRaw: "标准",
    note: "百炼渠道折扣示意",
  },
  {
    id: "wanxiang-i2v",
    vendor: "aliyun",
    displayName: "通义万相 图生视频",
    unit: "PER_SEC",
    listCostYuan: 0.58,
    discountRate: 0.1,
    tierRaw: "标准",
  },
  {
    id: "wanxiang-image",
    vendor: "aliyun",
    displayName: "通义万相 生图",
    unit: "PER_IMAGE",
    listCostYuan: 0.08,
    discountRate: 0.1,
    tierRaw: "标准",
  },
  {
    id: "qwen-turbo",
    vendor: "aliyun",
    displayName: "Qwen Turbo LLM",
    unit: "PER_KTOKEN",
    listCostYuan: 0.002,
    discountRate: 0.1,
    tierRaw: "千 token",
  },
];

export interface CreditAcquisitionSku {
  id: string;
  label: string;
  channel: "SUBSCRIPTION" | "TOPUP" | "API";
  priceYuan: number;
  credits: number;
  tier?: string;
}

/** App 个人月付订阅（现网 seed 月费；积分量可随调价变更） */
export const SUBSCRIPTION_MONTH_SKUS: CreditAcquisitionSku[] = [
  { id: "personal-标准", label: "标准版月付", channel: "SUBSCRIPTION", priceYuan: 69, credits: 1000, tier: "标准版" },
  { id: "personal-进阶", label: "进阶版月付", channel: "SUBSCRIPTION", priceYuan: 149, credits: 3000, tier: "进阶版" },
  { id: "personal-高级", label: "高级版月付", channel: "SUBSCRIPTION", priceYuan: 299, credits: 6500, tier: "高级版" },
  { id: "personal-豪华", label: "豪华版月付", channel: "SUBSCRIPTION", priceYuan: 599, credits: 14000, tier: "豪华版" },
  { id: "personal-至尊", label: "至尊版月付", channel: "SUBSCRIPTION", priceYuan: 1199, credits: 30000, tier: "至尊版" },
];

export const APP_TOPUP_SKUS: CreditAcquisitionSku[] = [
  { id: "pack-light", label: "轻量包", channel: "TOPUP", priceYuan: 62, credits: 1500 },
  { id: "pack-standard", label: "标准包", channel: "TOPUP", priceYuan: 160, credits: 4000 },
  { id: "pack-plus", label: "加量包", channel: "TOPUP", priceYuan: 304, credits: 8000 },
];

export const API_TOPUP_SKUS: CreditAcquisitionSku[] = [
  { id: "api-pack-38", label: "API 入门", channel: "API", priceYuan: 38, credits: 1040 },
  { id: "api-pack-188", label: "API 标准", channel: "API", priceYuan: 188, credits: 5000 },
  { id: "api-pack-368", label: "API 加量", channel: "API", priceYuan: 368, credits: 10000 },
  { id: "api-pack-1888", label: "API 专业", channel: "API", priceYuan: 1888, credits: 51600 },
  { id: "api-pack-4688", label: "API 企业", channel: "API", priceYuan: 4688, credits: 128000 },
];

export interface ModelQuoteRow {
  canonicalModelKey: string;
  vendor: string;
  displayName: string;
  unit: CreditCostUnit;
  listCostYuan: number;
  discountRate: number;
  netCostYuan: number;
  marginM: number;
  listPriceYuan: number;
  creditsPerUnit: number;
  baseMarginRate: number;
  marginOk: boolean;
  minGuard: number;
  /** 视频：15s 扣分（人人相同） */
  chargeCredits15s: number | null;
  netCost15s: number | null;
}

export interface SkuMarginRow {
  skuId: string;
  label: string;
  channel: CreditAcquisitionSku["channel"];
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
  config: PricingConfig;
  formulaLines: readonly string[];
  models: ModelQuoteRow[];
  subscriptionSkus: SkuMarginRow[];
  topupSkus: SkuMarginRow[];
  apiSkus: SkuMarginRow[];
  /** 锚定模型（Seedance 2.0 15s）用于 SKU 表 */
  anchorModelKey: string;
}

export function computeModelQuoteRow(
  model: ReferenceVendorModel,
  config: PricingConfig,
): ModelQuoteRow {
  const netCostYuan = round4(computeNetCost(model.listCostYuan, model.discountRate));
  const marginM = resolveModelMarginM({
    unit: model.unit,
    netCostYuan,
    listCostYuan: model.listCostYuan,
    defaultMarginM: config.defaultMarginM,
    videoMarginM: config.videoMarginM,
  });
  const minGuard = marginGuardForUnit(model.unit, config);
  const comp = computeCreditPrice({
    listCostYuan: model.listCostYuan,
    discountRate: model.discountRate,
    marginM,
    anchorYuan: config.creditAnchorYuan,
  });

  let chargeCredits15s: number | null = null;
  let netCost15s: number | null = null;
  if (model.unit === "PER_SEC") {
    const units = videoBillableSeconds(null, config.defaultVideoSec);
    netCost15s = round4(netCostYuan * units);
    chargeCredits15s = computeUnifiedChargeCredits({
      creditsPerUnit: comp.creditsPerUnit,
      units,
    });
  }

  return {
    canonicalModelKey: model.id,
    vendor: model.vendor,
    displayName: model.displayName,
    unit: model.unit,
    listCostYuan: model.listCostYuan,
    discountRate: model.discountRate,
    netCostYuan,
    marginM,
    listPriceYuan: comp.listPriceYuan,
    creditsPerUnit: comp.creditsPerUnit,
    baseMarginRate: comp.baseMarginRate,
    marginOk: marginPassesGuard(comp.baseMarginRate, minGuard),
    minGuard,
    chargeCredits15s,
    netCost15s,
  };
}

function buildSkuMarginRows(
  skus: CreditAcquisitionSku[],
  anchor: ModelQuoteRow,
  config: PricingConfig,
): SkuMarginRow[] {
  const chargeCredits =
    anchor.chargeCredits15s ??
    computeUnifiedChargeCredits({ creditsPerUnit: anchor.creditsPerUnit, units: 1 });
  const netCostYuan =
    anchor.netCost15s ?? round4(anchor.netCostYuan * (anchor.unit === "PER_IMAGE" ? 1 : 1));
  const minGuard = marginGuardForUnit(anchor.unit, config);

  return skus.map((sku) => {
    const ppc = computePricePerCredit(sku.priceYuan, sku.credits);
    const revenueYuan = round4(chargeCredits * ppc);
    const marginRate = computeEffectiveMargin({
      netCostYuan,
      creditsPerUnit: chargeCredits,
      pricePerCreditYuan: ppc,
    });
    return {
      skuId: sku.id,
      label: sku.label,
      channel: sku.channel,
      priceYuan: sku.priceYuan,
      credits: sku.credits,
      pricePerCreditYuan: ppc,
      chargeCredits,
      netCostYuan,
      revenueYuan,
      marginRate,
      marginOk: marginPassesGuard(marginRate, minGuard),
      maxGenerations: Math.floor(sku.credits / chargeCredits),
    };
  });
}

export function buildUnifiedFormulaSimulation(config: PricingConfig): UnifiedFormulaSimulation {
  const models = REFERENCE_VENDOR_MODELS.map((m) => computeModelQuoteRow(m, config));
  const anchor =
    models.find((m) => m.canonicalModelKey === "seedance-2.0-720p-real") ?? models[0];

  return {
    version: UNIFIED_CREDIT_FORMULA_VERSION,
    config,
    formulaLines: UNIFIED_CREDIT_FORMULA_LINES,
    models,
    subscriptionSkus: buildSkuMarginRows(SUBSCRIPTION_MONTH_SKUS, anchor, config),
    topupSkus: buildSkuMarginRows(APP_TOPUP_SKUS, anchor, config),
    apiSkus: buildSkuMarginRows(API_TOPUP_SKUS, anchor, config),
    anchorModelKey: anchor.canonicalModelKey,
  };
}

/** 从 DB 成本档测算（与 publish 同口径） */
export function computeModelQuoteFromCostProfile(input: {
  canonicalModelKey: string;
  vendor: string;
  displayName: string;
  unit: CreditCostUnit;
  listCostYuan: number;
  discountRate: number;
  config: PricingConfig;
}): ModelQuoteRow {
  return computeModelQuoteRow(
    {
      id: input.canonicalModelKey,
      vendor: input.vendor,
      displayName: input.displayName,
      unit: input.unit,
      listCostYuan: input.listCostYuan,
      discountRate: input.discountRate,
    },
    input.config,
  );
}
