/**
 * 统一积分计费 — 计算引擎（unified-credit-billing）· DB 读写层
 *
 * 纯公式见 ./credit-pricing-formulas.ts（客户端/服务端共用，无 prisma 依赖）。
 * 本文件负责：读全局配置、按成本档发布积分报价（含毛利护栏）。
 *
 * 用户只见挂牌价/套餐/积分；成本、折扣、系数 M 仅后台财务可见。
 */
import { prisma } from "@/lib/prisma";

import {
  computeCreditPrice,
  DEFAULT_CREDIT_ANCHOR_YUAN,
  DEFAULT_MARGIN_M,
  DEFAULT_MIN_MARGIN_GUARD,
  DEFAULT_VIDEO_MARGIN_M,
  DEFAULT_VIDEO_MIN_MARGIN_GUARD,
  DEFAULT_VIDEO_SEC,
  FALLBACK_PRICING_CONFIG,
  marginGuardForUnit,
  marginMForUnit,
  marginPassesGuard,
  type PricingConfig,
} from "./credit-pricing-formulas";

export * from "./credit-pricing-formulas";

function toNum(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : fallback;
}

/** 读全局计费参数（无则回退默认，不写库） */
export async function loadPricingConfig(): Promise<PricingConfig> {
  const row = await prisma.platformPricingConfig.findUnique({ where: { id: "default" } });
  if (!row) return { ...FALLBACK_PRICING_CONFIG };
  return {
    creditAnchorYuan: toNum(row.creditAnchorYuan, DEFAULT_CREDIT_ANCHOR_YUAN),
    defaultMarginM: toNum(row.defaultMarginM, DEFAULT_MARGIN_M),
    minMarginGuard: toNum(row.minMarginGuard, DEFAULT_MIN_MARGIN_GUARD),
    defaultVideoSec: row.defaultVideoSec ?? DEFAULT_VIDEO_SEC,
    videoMarginM: toNum(row.videoMarginM, DEFAULT_VIDEO_MARGIN_M),
    videoMinMarginGuard: toNum(row.videoMinMarginGuard, DEFAULT_VIDEO_MIN_MARGIN_GUARD),
  };
}

export class MarginGuardError extends Error {
  constructor(
    public readonly actualMargin: number,
    public readonly minMargin: number,
    public readonly canonicalModelKey: string,
  ) {
    super(
      `毛利护栏拦截：模型 ${canonicalModelKey} 实际毛利 ${(actualMargin * 100).toFixed(1)}% 低于阈值 ${(minMargin * 100).toFixed(1)}%`,
    );
    this.name = "MarginGuardError";
  }
}

export interface PublishResult {
  canonicalModelKey: string;
  creditsPerUnit: number;
  listPriceYuan: number;
  baseMarginRate: number;
  netCostYuan: number;
}

/**
 * 由 ModelCostProfile 计算并发布 ModelCreditPrice。
 * - 选取生效中、优先 CHANNEL 折扣的成本档。
 * - 毛利低于 minMarginGuard 时抛 MarginGuardError，拒绝发布。
 */
export async function publishModelCreditPrice(input: {
  canonicalModelKey: string;
  displayName: string;
  marginM?: number;
  publishedBy?: string;
}): Promise<PublishResult> {
  const config = await loadPricingConfig();
  const now = new Date();

  const profiles = await prisma.modelCostProfile.findMany({
    where: {
      canonicalModelKey: input.canonicalModelKey,
      active: true,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
  });
  if (profiles.length === 0) {
    throw new Error(`未找到生效中的成本档：${input.canonicalModelKey}`);
  }

  // 渠道优先级：CHANNEL（折扣）→ RESELLER → OWN；同档取净成本最低
  const channelRank: Record<string, number> = { CHANNEL: 0, RESELLER: 1, OWN: 2 };
  const chosen = [...profiles].sort((a, b) => {
    const r = (channelRank[a.channel] ?? 9) - (channelRank[b.channel] ?? 9);
    if (r !== 0) return r;
    return toNum(a.netCostYuan) - toNum(b.netCostYuan);
  })[0];

  // 按计费类型取系数 M 与毛利护栏（视频 PER_SEC → videoMarginM=4 / 护栏 0.75）
  const marginM =
    input.marginM ??
    marginMForUnit(chosen.unit, {
      defaultMarginM: config.defaultMarginM,
      videoMarginM: config.videoMarginM,
    });
  const minGuard = marginGuardForUnit(chosen.unit, {
    minMarginGuard: config.minMarginGuard,
    videoMinMarginGuard: config.videoMinMarginGuard,
  });
  const comp = computeCreditPrice({
    listCostYuan: toNum(chosen.listCostYuan),
    discountRate: toNum(chosen.discountRate),
    marginM,
    anchorYuan: config.creditAnchorYuan,
  });

  if (!marginPassesGuard(comp.baseMarginRate, minGuard)) {
    throw new MarginGuardError(comp.baseMarginRate, minGuard, input.canonicalModelKey);
  }

  const snapshot = { ...comp.formulaSnapshot, publishedAt: new Date().toISOString() };

  const saved = await prisma.modelCreditPrice.upsert({
    where: { canonicalModelKey: input.canonicalModelKey },
    create: {
      canonicalModelKey: input.canonicalModelKey,
      displayName: input.displayName,
      vendor: chosen.vendor,
      unit: chosen.unit,
      tierRaw: chosen.tierRaw,
      netCostYuan: comp.netCostYuan,
      marginM,
      listPriceYuan: comp.listPriceYuan,
      creditsPerUnit: comp.creditsPerUnit,
      baseMarginRate: comp.baseMarginRate,
      formulaSnapshot: snapshot,
      active: true,
      publishedBy: input.publishedBy,
    },
    update: {
      displayName: input.displayName,
      vendor: chosen.vendor,
      unit: chosen.unit,
      tierRaw: chosen.tierRaw,
      netCostYuan: comp.netCostYuan,
      marginM,
      listPriceYuan: comp.listPriceYuan,
      creditsPerUnit: comp.creditsPerUnit,
      baseMarginRate: comp.baseMarginRate,
      formulaSnapshot: snapshot,
      active: true,
      publishedAt: new Date(),
      publishedBy: input.publishedBy,
    },
  });

  return {
    canonicalModelKey: saved.canonicalModelKey,
    creditsPerUnit: saved.creditsPerUnit,
    listPriceYuan: toNum(saved.listPriceYuan),
    baseMarginRate: toNum(saved.baseMarginRate),
    netCostYuan: toNum(saved.netCostYuan),
  };
}
