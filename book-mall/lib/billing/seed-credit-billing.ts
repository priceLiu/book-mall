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
  DEFAULT_VIDEO_MARGIN_M,
  DEFAULT_VIDEO_MIN_MARGIN_GUARD,
  DEFAULT_VIDEO_SEC,
  publishModelCreditPrice,
} from "@/lib/pricing/credit-pricing-engine";
import { deriveVideoMonthlyCredits } from "@/lib/billing/video-model-seeds";
import { seedByokSimplifiedPricing } from "@/lib/billing/byok-pricing";
import {
  RETIRED_TEAM_TIERS,
  TEAM_MIN_INCLUDED_SEATS,
} from "@/lib/billing/team-membership-config";

/** 逐档「每积分单价」= 套餐价 ÷ (含席位数 × 月积分)；个人 includedSeats=1。 */
function derivePricePerCredit(priceYuan: number, monthlyCredits: number, includedSeats: number): number {
  const denom = Math.max(1, includedSeats) * monthlyCredits;
  if (denom <= 0) return 0;
  return Math.round((priceYuan / denom) * 1e6) / 1e6;
}

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
  { tier: "标准版", sortOrder: 1, priceYuan: 69, originalYuan: 99, monthlyCredits: 1000, includedSeats: 1 },
  { tier: "进阶版", sortOrder: 2, priceYuan: 149, originalYuan: 219, monthlyCredits: 3000, includedSeats: 1 },
  { tier: "高级版", sortOrder: 3, priceYuan: 299, originalYuan: 449, monthlyCredits: 6500, includedSeats: 1 },
  { tier: "豪华版", sortOrder: 4, priceYuan: 599, originalYuan: 899, monthlyCredits: 14000, includedSeats: 1 },
  { tier: "至尊版", sortOrder: 5, priceYuan: 1199, originalYuan: 1799, monthlyCredits: 30000, includedSeats: 1 },
];

// 个人 · 年付（约 10 个月价；积分 = 月额 × 12）
const PERSONAL_YEAR: PlanSeed[] = [
  { tier: "标准版", sortOrder: 1, priceYuan: 690, originalYuan: 990, promoLabel: "年付立省2个月", monthlyCredits: 12000, includedSeats: 1 },
  { tier: "进阶版", sortOrder: 2, priceYuan: 1490, originalYuan: 2190, promoLabel: "年付立省2个月", monthlyCredits: 36000, includedSeats: 1 },
  { tier: "高级版", sortOrder: 3, priceYuan: 2990, originalYuan: 4490, promoLabel: "年付立省2个月", monthlyCredits: 78000, includedSeats: 1 },
  { tier: "豪华版", sortOrder: 4, priceYuan: 5990, originalYuan: 8990, promoLabel: "年付立省2个月", monthlyCredits: 168000, includedSeats: 1 },
  { tier: "至尊版", sortOrder: 5, priceYuan: 11990, originalYuan: 17990, promoLabel: "年付立省2个月", monthlyCredits: 360000, includedSeats: 1 },
];

// 团队 · 月付（按席计价：起订 3 席；标准版 ¥199 起，五档至 ¥1999/席）
const TEAM_MONTH: PlanSeed[] = [
  { tier: "标准版", sortOrder: 1, priceYuan: 597, originalYuan: 837, monthlyCredits: 4600, includedSeats: TEAM_MIN_INCLUDED_SEATS },
  { tier: "进阶版", sortOrder: 2, priceYuan: 2067, originalYuan: 2799, monthlyCredits: 17400, includedSeats: TEAM_MIN_INCLUDED_SEATS },
  { tier: "高级版", sortOrder: 3, priceYuan: 3597, originalYuan: 4797, monthlyCredits: 33300, includedSeats: TEAM_MIN_INCLUDED_SEATS },
  { tier: "豪华版", sortOrder: 4, priceYuan: 5097, originalYuan: 6597, monthlyCredits: 51500, includedSeats: TEAM_MIN_INCLUDED_SEATS },
  { tier: "至尊版", sortOrder: 5, priceYuan: 5997, originalYuan: 7997, monthlyCredits: 66600, includedSeats: TEAM_MIN_INCLUDED_SEATS },
];

// 团队 · 年付（每席价 ×10 个月；priceYuan = 每席年价 × 3）
const TEAM_YEAR: PlanSeed[] = [
  { tier: "标准版", sortOrder: 1, priceYuan: 5970, originalYuan: 8370, promoLabel: "年付立省2个月", monthlyCredits: 55200, includedSeats: TEAM_MIN_INCLUDED_SEATS },
  { tier: "进阶版", sortOrder: 2, priceYuan: 20670, originalYuan: 27990, promoLabel: "年付立省2个月", monthlyCredits: 208800, includedSeats: TEAM_MIN_INCLUDED_SEATS },
  { tier: "高级版", sortOrder: 3, priceYuan: 35970, originalYuan: 47970, promoLabel: "年付立省2个月", monthlyCredits: 399600, includedSeats: TEAM_MIN_INCLUDED_SEATS },
  { tier: "豪华版", sortOrder: 4, priceYuan: 50970, originalYuan: 65970, promoLabel: "年付立省2个月", monthlyCredits: 618000, includedSeats: TEAM_MIN_INCLUDED_SEATS },
  { tier: "至尊版", sortOrder: 5, priceYuan: 59970, originalYuan: 79970, promoLabel: "年付立省2个月", monthlyCredits: 799200, includedSeats: TEAM_MIN_INCLUDED_SEATS },
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
  标准版: [{ seatMin: 3, seatMax: null, perSeatPriceMonthYuan: 199, perSeatCredits: 4600, sortOrder: 1 }],
  进阶版: [{ seatMin: 3, seatMax: null, perSeatPriceMonthYuan: 689, perSeatCredits: 17400, sortOrder: 1 }],
  高级版: [{ seatMin: 3, seatMax: null, perSeatPriceMonthYuan: 1199, perSeatCredits: 33300, sortOrder: 1 }],
  豪华版: [{ seatMin: 3, seatMax: null, perSeatPriceMonthYuan: 1699, perSeatCredits: 51500, sortOrder: 1 }],
  至尊版: [{ seatMin: 3, seatMax: null, perSeatPriceMonthYuan: 1999, perSeatCredits: 66600, sortOrder: 1 }],
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
// 模型成本档改由 scripts/seed-platform-model-costs.ts + Gateway 注册表维护（不再 seed 遗留 canonical）
const COST_SEEDS: CostSeed[] = [];

async function seedPlans(
  family: "PERSONAL" | "TEAM",
  interval: "MONTH" | "YEAR",
  seeds: PlanSeed[],
  withSeatTiers: boolean,
) {
  for (const s of seeds) {
    const pricePerCreditYuan = derivePricePerCredit(s.priceYuan, s.monthlyCredits, s.includedSeats);
    const videoMonthlyCredits = deriveVideoMonthlyCredits(s.monthlyCredits);
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
        videoMonthlyCredits,
        pricePerCreditYuan,
        includedSeats: s.includedSeats,
        active: true,
      },
      update: {
        sortOrder: s.sortOrder,
        priceYuan: s.priceYuan,
        originalYuan: s.originalYuan ?? null,
        promoLabel: s.promoLabel ?? null,
        monthlyCredits: s.monthlyCredits,
        videoMonthlyCredits,
        pricePerCreditYuan,
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
  videoModels: number;
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
      videoMarginM: DEFAULT_VIDEO_MARGIN_M,
      videoMinMarginGuard: DEFAULT_VIDEO_MIN_MARGIN_GUARD,
    },
    update: {
      defaultVideoSec: DEFAULT_VIDEO_SEC,
      videoMarginM: DEFAULT_VIDEO_MARGIN_M,
      videoMinMarginGuard: DEFAULT_VIDEO_MIN_MARGIN_GUARD,
    },
  });

  // 2) 套餐 + 席位带
  await seedPlans("PERSONAL", "MONTH", PERSONAL_MONTH, false);
  await seedPlans("PERSONAL", "YEAR", PERSONAL_YEAR, false);
  await seedPlans("TEAM", "MONTH", TEAM_MONTH, true);
  await seedPlans("TEAM", "YEAR", TEAM_YEAR, true);
  await prisma.membershipPlan.updateMany({
    where: { family: "TEAM", tier: { in: [...RETIRED_TEAM_TIERS] } },
    data: { active: false },
  });
  const plansCount = PERSONAL_MONTH.length * 2 + TEAM_MONTH.length * 2;

  // 3) BYOK 任务额度 + 资源系数（技术服务费已退役）
  await seedByokSimplifiedPricing();

  const resourceRates: { type: "OSS_GB_MONTH" | "EGRESS_GB" | "TASK_COUNT"; coef: number; unit: string }[] = [
    { type: "OSS_GB_MONTH", coef: 0.12, unit: "GB·月" },
    { type: "EGRESS_GB", coef: 0.5, unit: "GB" },
    { type: "TASK_COUNT", coef: 0, unit: "次" },
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

  return {
    plans: plansCount,
    costProfiles: COST_SEEDS.length,
    videoModels: 0,
    published,
    publishErrors,
  };
}
