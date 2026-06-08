/**
 * 统一积分计费 — 首版数据落库（unified-credit-billing）
 *
 * 幂等：全部 upsert。可重复执行。
 *  - PlatformPricingConfig（锚定 0.04 / M=2.5 / 护栏 0.30 / 视频 5s）
 *  - MembershipPlan + TeamSeatTier（个人/团队 × 月/年 × 五档；算法2 g=60%）
 *  - ByokServiceConfig + ResourceMeterRate（BYOK 技术服务费 + 资源系数）
 *  - ModelCostProfile（示例成本档）→ publishModelCreditPrice 生成首版报价快照
 *
 * 套餐金额为首版占位（与图1–4 一致的结构：个人/团队、月/年、五档、席位带），
 * 落库后由后台 /admin/finance/membership-plans 可视化维护。
 */
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_CREDIT_ANCHOR_YUAN,
  DEFAULT_MARGIN_M,
  DEFAULT_MIN_MARGIN_GUARD,
  DEFAULT_VIDEO_SEC,
  publishModelCreditPrice,
} from "@/lib/pricing/credit-pricing-engine";

const TIERS = ["标准版", "进阶版", "高级版", "豪华版", "至尊版"] as const;

interface PlanSeed {
  tier: string;
  sortOrder: number;
  priceYuan: number;
  originalYuan?: number;
  promoLabel?: string;
  monthlyCredits: number;
  includedSeats: number;
}

// 个人 · 月付（锚定 ¥0.04；积分 ≈ 价 ÷ 0.04，会员利润主要来自模型渠道差价）
const PERSONAL_MONTH: PlanSeed[] = [
  { tier: "标准版", sortOrder: 1, priceYuan: 39, originalYuan: 59, monthlyCredits: 1000, includedSeats: 1 },
  { tier: "进阶版", sortOrder: 2, priceYuan: 99, originalYuan: 149, monthlyCredits: 3000, includedSeats: 1 },
  { tier: "高级版", sortOrder: 3, priceYuan: 199, originalYuan: 299, monthlyCredits: 6500, includedSeats: 1 },
  { tier: "豪华版", sortOrder: 4, priceYuan: 399, originalYuan: 599, monthlyCredits: 14000, includedSeats: 1 },
  { tier: "至尊版", sortOrder: 5, priceYuan: 799, originalYuan: 1199, monthlyCredits: 30000, includedSeats: 1 },
];

// 个人 · 年付（约 10 个月价；积分 = 月额 × 12）
const PERSONAL_YEAR: PlanSeed[] = [
  { tier: "标准版", sortOrder: 1, priceYuan: 390, originalYuan: 708, promoLabel: "年付立省2个月", monthlyCredits: 12000, includedSeats: 1 },
  { tier: "进阶版", sortOrder: 2, priceYuan: 990, originalYuan: 1788, promoLabel: "年付立省2个月", monthlyCredits: 36000, includedSeats: 1 },
  { tier: "高级版", sortOrder: 3, priceYuan: 1990, originalYuan: 3588, promoLabel: "年付立省2个月", monthlyCredits: 78000, includedSeats: 1 },
  { tier: "豪华版", sortOrder: 4, priceYuan: 3990, originalYuan: 7188, promoLabel: "年付立省2个月", monthlyCredits: 168000, includedSeats: 1 },
  { tier: "至尊版", sortOrder: 5, priceYuan: 7990, originalYuan: 14388, promoLabel: "年付立省2个月", monthlyCredits: 360000, includedSeats: 1 },
];

// 团队 · 月付（按席计价：起订 2 席，priceYuan = 每席价(首档) × 2，monthlyCredits = 每席积分）
// 至尊版起步 = ¥858（2 席 / 30,000 积分），不再「基础套餐塞 10 席」；加席走席位带量价递减。
const TEAM_MONTH: PlanSeed[] = [
  { tier: "标准版", sortOrder: 1, priceYuan: 118, originalYuan: 178, monthlyCredits: 1500, includedSeats: 2 },
  { tier: "进阶版", sortOrder: 2, priceYuan: 198, originalYuan: 298, monthlyCredits: 3000, includedSeats: 2 },
  { tier: "高级版", sortOrder: 3, priceYuan: 378, originalYuan: 568, monthlyCredits: 5000, includedSeats: 2 },
  { tier: "豪华版", sortOrder: 4, priceYuan: 498, originalYuan: 748, monthlyCredits: 8000, includedSeats: 2 },
  { tier: "至尊版", sortOrder: 5, priceYuan: 858, originalYuan: 1298, monthlyCredits: 15000, includedSeats: 2 },
];

// 团队 · 年付（每席价 ×10 个月、每席积分 ×12；priceYuan = 每席年价 × 2）
const TEAM_YEAR: PlanSeed[] = [
  { tier: "标准版", sortOrder: 1, priceYuan: 1180, originalYuan: 2136, promoLabel: "年付立省2个月", monthlyCredits: 18000, includedSeats: 2 },
  { tier: "进阶版", sortOrder: 2, priceYuan: 1980, originalYuan: 3576, promoLabel: "年付立省2个月", monthlyCredits: 36000, includedSeats: 2 },
  { tier: "高级版", sortOrder: 3, priceYuan: 3780, originalYuan: 6816, promoLabel: "年付立省2个月", monthlyCredits: 60000, includedSeats: 2 },
  { tier: "豪华版", sortOrder: 4, priceYuan: 4980, originalYuan: 8976, promoLabel: "年付立省2个月", monthlyCredits: 96000, includedSeats: 2 },
  { tier: "至尊版", sortOrder: 5, priceYuan: 8580, originalYuan: 15576, promoLabel: "年付立省2个月", monthlyCredits: 180000, includedSeats: 2 },
];

// 团队席位带（人数越多每席单价越低）— perSeatPrice 取月口径，年付折算 ×10；每席积分恒定（= 该档每席积分）
interface SeatTierSeed {
  seatMin: number;
  seatMax: number | null;
  perSeatPriceMonthYuan: number;
  perSeatCredits: number;
  sortOrder: number;
}
const SEAT_TIERS_BY_TIER: Record<string, SeatTierSeed[]> = {
  标准版: [
    { seatMin: 1, seatMax: 2, perSeatPriceMonthYuan: 59, perSeatCredits: 1500, sortOrder: 1 },
    { seatMin: 3, seatMax: 5, perSeatPriceMonthYuan: 49, perSeatCredits: 1500, sortOrder: 2 },
    { seatMin: 6, seatMax: null, perSeatPriceMonthYuan: 39, perSeatCredits: 1500, sortOrder: 3 },
  ],
  进阶版: [
    { seatMin: 1, seatMax: 2, perSeatPriceMonthYuan: 99, perSeatCredits: 3000, sortOrder: 1 },
    { seatMin: 3, seatMax: 5, perSeatPriceMonthYuan: 89, perSeatCredits: 3000, sortOrder: 2 },
    { seatMin: 6, seatMax: null, perSeatPriceMonthYuan: 79, perSeatCredits: 3000, sortOrder: 3 },
  ],
  高级版: [
    { seatMin: 1, seatMax: 5, perSeatPriceMonthYuan: 189, perSeatCredits: 5000, sortOrder: 1 },
    { seatMin: 6, seatMax: 10, perSeatPriceMonthYuan: 169, perSeatCredits: 5000, sortOrder: 2 },
    { seatMin: 11, seatMax: null, perSeatPriceMonthYuan: 149, perSeatCredits: 5000, sortOrder: 3 },
  ],
  豪华版: [
    { seatMin: 1, seatMax: 10, perSeatPriceMonthYuan: 249, perSeatCredits: 8000, sortOrder: 1 },
    { seatMin: 11, seatMax: 20, perSeatPriceMonthYuan: 229, perSeatCredits: 8000, sortOrder: 2 },
    { seatMin: 21, seatMax: null, perSeatPriceMonthYuan: 209, perSeatCredits: 8000, sortOrder: 3 },
  ],
  至尊版: [
    { seatMin: 1, seatMax: 10, perSeatPriceMonthYuan: 429, perSeatCredits: 15000, sortOrder: 1 },
    { seatMin: 11, seatMax: 20, perSeatPriceMonthYuan: 389, perSeatCredits: 15000, sortOrder: 2 },
    { seatMin: 21, seatMax: null, perSeatPriceMonthYuan: 359, perSeatCredits: 15000, sortOrder: 3 },
  ],
};

// 示例模型成本档（占位，落库后由 /admin/finance/model-cost 维护）
interface CostSeed {
  canonicalModelKey: string;
  displayName: string;
  vendor: string;
  unit: "PER_SEC" | "PER_IMAGE" | "PER_KTOKEN";
  tierRaw?: string;
  listCostYuan: number;
  discountRate: number; // 渠道折扣（节省比例）
}
const COST_SEEDS: CostSeed[] = [
  { canonicalModelKey: "seedance-720p", displayName: "Seedance 视频 720P", vendor: "volcengine", unit: "PER_SEC", tierRaw: "720P", listCostYuan: 0.45, discountRate: 0.1 },
  { canonicalModelKey: "kling-video", displayName: "可灵 视频", vendor: "kie", unit: "PER_SEC", tierRaw: "标准", listCostYuan: 0.6, discountRate: 0.05 },
  { canonicalModelKey: "happyhorse-r2v", displayName: "HappyHorse 参考图生视频", vendor: "aliyun", unit: "PER_SEC", tierRaw: "标准", listCostYuan: 0.9, discountRate: 0.1 },
  { canonicalModelKey: "lib-image", displayName: "通义万相 文生图", vendor: "aliyun", unit: "PER_IMAGE", tierRaw: "1K", listCostYuan: 0.1, discountRate: 0.1 },
  { canonicalModelKey: "lib-nano-pro", displayName: "Nano Pro 高清生图", vendor: "kie", unit: "PER_IMAGE", tierRaw: "2K", listCostYuan: 0.3, discountRate: 0.05 },
];

async function seedPlans(
  family: "PERSONAL" | "TEAM",
  interval: "MONTH" | "YEAR",
  seeds: PlanSeed[],
  withSeatTiers: boolean,
) {
  for (const s of seeds) {
    const plan = await prisma.membershipPlan.upsert({
      where: { family_interval_tier: { family, interval, tier: s.tier } },
      create: {
        family,
        interval,
        tier: s.tier,
        sortOrder: s.sortOrder,
        priceYuan: s.priceYuan,
        originalYuan: s.originalYuan ?? null,
        promoLabel: s.promoLabel ?? null,
        monthlyCredits: s.monthlyCredits,
        includedSeats: s.includedSeats,
        active: true,
      },
      update: {
        sortOrder: s.sortOrder,
        priceYuan: s.priceYuan,
        originalYuan: s.originalYuan ?? null,
        promoLabel: s.promoLabel ?? null,
        monthlyCredits: s.monthlyCredits,
        includedSeats: s.includedSeats,
        active: true,
      },
    });

    if (withSeatTiers) {
      const tiers = SEAT_TIERS_BY_TIER[s.tier] ?? [];
      // 席位带按 plan 重建（先清后插，保持幂等）
      await prisma.teamSeatTier.deleteMany({ where: { planId: plan.id } });
      for (const t of tiers) {
        const perSeatPrice = interval === "YEAR" ? t.perSeatPriceMonthYuan * 10 : t.perSeatPriceMonthYuan;
        const perSeatCredits = interval === "YEAR" ? t.perSeatCredits * 12 : t.perSeatCredits;
        await prisma.teamSeatTier.create({
          data: {
            planId: plan.id,
            seatMin: t.seatMin,
            seatMax: t.seatMax,
            perSeatPriceYuan: perSeatPrice,
            perSeatCredits,
            sortOrder: t.sortOrder,
          },
        });
      }
    }
  }
}

export interface SeedSummary {
  plans: number;
  costProfiles: number;
  published: { canonicalModelKey: string; creditsPerUnit: number; baseMarginRate: number }[];
  publishErrors: { canonicalModelKey: string; error: string }[];
}

export async function seedUnifiedCreditBilling(publishedBy = "seed"): Promise<SeedSummary> {
  // 1) 全局参数
  await prisma.platformPricingConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      creditAnchorYuan: DEFAULT_CREDIT_ANCHOR_YUAN,
      defaultMarginM: DEFAULT_MARGIN_M,
      minMarginGuard: DEFAULT_MIN_MARGIN_GUARD,
      defaultVideoSec: DEFAULT_VIDEO_SEC,
    },
    update: {},
  });

  // 2) 套餐 + 席位带
  await seedPlans("PERSONAL", "MONTH", PERSONAL_MONTH, false);
  await seedPlans("PERSONAL", "YEAR", PERSONAL_YEAR, false);
  await seedPlans("TEAM", "MONTH", TEAM_MONTH, true);
  await seedPlans("TEAM", "YEAR", TEAM_YEAR, true);
  const plansCount = TIERS.length * 4;

  // 3) BYOK 技术服务费（按档占位）+ 资源系数
  const byokScopes: { scopeKey: string; label: string; fee: number }[] = [
    { scopeKey: "personal-standard", label: "个人·标准（BYOK 技术服务费）", fee: 19 },
    { scopeKey: "personal-pro", label: "个人·进阶及以上（BYOK 技术服务费）", fee: 49 },
    { scopeKey: "team-base", label: "团队·基础（BYOK 技术服务费）", fee: 99 },
    { scopeKey: "team-seat", label: "团队·每席位（BYOK 技术服务费）", fee: 29 },
  ];
  for (const b of byokScopes) {
    await prisma.byokServiceConfig.upsert({
      where: { scopeKey: b.scopeKey },
      create: { scopeKey: b.scopeKey, label: b.label, techServiceFeeYuan: b.fee, interval: "MONTH", active: true },
      update: { label: b.label, techServiceFeeYuan: b.fee, active: true },
    });
  }

  const resourceRates: { type: "OSS_GB_MONTH" | "EGRESS_GB" | "TASK_COUNT"; coef: number; unit: string }[] = [
    { type: "OSS_GB_MONTH", coef: 0.12, unit: "GB·月" },
    { type: "EGRESS_GB", coef: 0.5, unit: "GB" },
    { type: "TASK_COUNT", coef: 0.01, unit: "次" },
  ];
  for (const r of resourceRates) {
    await prisma.resourceMeterRate.upsert({
      where: { resourceType: r.type },
      create: { resourceType: r.type, coefficientYuan: r.coef, unitLabel: r.unit, active: true },
      update: { coefficientYuan: r.coef, unitLabel: r.unit, active: true },
    });
  }

  // 4) 模型成本档（确定性 id 便于幂等）+ 发布报价
  for (const c of COST_SEEDS) {
    const netCost = c.listCostYuan * (1 - c.discountRate);
    const id = `seed-${c.canonicalModelKey}-CHANNEL`;
    const data: Prisma.ModelCostProfileUncheckedCreateInput = {
      id,
      vendor: c.vendor,
      canonicalModelKey: c.canonicalModelKey,
      channel: "CHANNEL",
      unit: c.unit,
      tierRaw: c.tierRaw ?? null,
      listCostYuan: c.listCostYuan,
      discountRate: c.discountRate,
      netCostYuan: netCost,
      active: true,
      note: "seed 占位成本档",
    };
    await prisma.modelCostProfile.upsert({ where: { id }, create: data, update: data });
  }

  const published: SeedSummary["published"] = [];
  const publishErrors: SeedSummary["publishErrors"] = [];
  for (const c of COST_SEEDS) {
    try {
      const r = await publishModelCreditPrice({
        canonicalModelKey: c.canonicalModelKey,
        displayName: c.displayName,
        publishedBy,
      });
      published.push({ canonicalModelKey: r.canonicalModelKey, creditsPerUnit: r.creditsPerUnit, baseMarginRate: r.baseMarginRate });
    } catch (e) {
      publishErrors.push({ canonicalModelKey: c.canonicalModelKey, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return { plans: plansCount, costProfiles: COST_SEEDS.length, published, publishErrors };
}
