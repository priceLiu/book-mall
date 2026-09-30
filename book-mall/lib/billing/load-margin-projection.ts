import { TEAM_MIN_INCLUDED_SEATS } from "@/lib/billing/team-membership-config";
import {
  buildMarginProjection,
  MARGIN_PROJECTION_FALLBACK_PLANS,
  MARGIN_PROJECTION_MODEL_SPECS,
  quoteProjectionModel,
  type MarginProjectionModelQuote,
  type MarginProjectionPlanInput,
  type MarginProjectionSource,
} from "@/lib/billing/margin-projection";
import { prisma } from "@/lib/prisma";
import { loadPricingConfig } from "@/lib/pricing/credit-pricing-engine";
import {
  findModelCreditPrice,
  pickActiveCostProfile,
} from "@/lib/pricing/model-credit-price-store";

function toNum(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : fallback;
}

function plansFromDb(
  rows: {
    family: string;
    tier: string;
    sortOrder: number;
    priceYuan: unknown;
    monthlyCredits: unknown;
    includedSeats: number;
  }[],
  family: "PERSONAL" | "TEAM",
): MarginProjectionPlanInput[] {
  return rows
    .filter((p) => p.family === family)
    .map((p) => ({
      family,
      tier: p.tier,
      sortOrder: p.sortOrder,
      priceYuan: toNum(p.priceYuan),
      monthlyCredits: toNum(p.monthlyCredits),
      includedSeats: family === "TEAM" ? Math.max(TEAM_MIN_INCLUDED_SEATS, p.includedSeats || TEAM_MIN_INCLUDED_SEATS) : 1,
    }));
}

async function resolveLiveModels(
  pricing: { creditAnchorYuan: number; defaultVideoSec: number },
): Promise<MarginProjectionModelQuote[]> {
  const now = new Date();
  const quotes: MarginProjectionModelQuote[] = [];
  for (const spec of MARGIN_PROJECTION_MODEL_SPECS) {
    const profiles = await prisma.modelCostProfile.findMany({
      where: {
        canonicalModelKey: { in: spec.keys },
        active: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        ...(spec.tierRaw ? { tierRaw: spec.tierRaw } : {}),
      },
    });
    const picked = pickActiveCostProfile(profiles);
    if (!picked) {
      quotes.push(quoteProjectionModel(spec, pricing));
      continue;
    }
    const published = await findModelCreditPrice({
      canonicalModelKey: picked.canonicalModelKey,
      tierRaw: picked.tierRaw ?? spec.tierRaw,
    });
    const publishedActive = published?.active ? published : null;
    quotes.push(
      quoteProjectionModel(spec, pricing, {
        canonicalModelKey: picked.canonicalModelKey,
        listCostYuan: toNum(picked.listCostYuan) || spec.listCostYuan,
        discountRate: toNum(picked.discountRate),
        netCostYuan: toNum(picked.netCostYuan) || undefined,
        marginM: toNum(picked.marginM) || undefined,
        creditsPerUnit: publishedActive ? toNum(publishedActive.creditsPerUnit) : undefined,
        listPriceYuan: publishedActive ? toNum(publishedActive.listPriceYuan) : undefined,
        source: publishedActive ? "published" : "cost-profile",
      }),
    );
  }
  return quotes;
}

export async function loadMarginProjection() {
  try {
    return await loadMarginProjectionFromDb();
  } catch (err) {
    console.error("[margin-projection] live load failed, using seed", err);
    return buildMarginProjection({});
  }
}

async function loadMarginProjectionFromDb() {
  const config = await loadPricingConfig();
  const pricing = {
    creditAnchorYuan: config.creditAnchorYuan,
    defaultVideoSec: config.defaultVideoSec,
  };

  const dbPlans = await prisma.membershipPlan.findMany({
    where: { active: true, family: { in: ["PERSONAL", "TEAM"] } },
    orderBy: [{ family: "asc" }, { interval: "asc" }, { sortOrder: "asc" }],
  });
  const monthPlans = dbPlans.filter((p) => p.interval === "MONTH");
  const yearPlans = dbPlans.filter((p) => p.interval === "YEAR");

  const personalLive = plansFromDb(monthPlans, "PERSONAL");
  const teamLive = plansFromDb(monthPlans, "TEAM");
  const personalYearLive = plansFromDb(yearPlans, "PERSONAL");
  const teamYearLive = plansFromDb(yearPlans, "TEAM");
  const personalPlans = personalLive.length > 0 ? personalLive : MARGIN_PROJECTION_FALLBACK_PLANS.filter((p) => p.family === "PERSONAL");
  const teamPlans = teamLive.length > 0 ? teamLive : MARGIN_PROJECTION_FALLBACK_PLANS.filter((p) => p.family === "TEAM");
  const personalSource: MarginProjectionSource = personalLive.length > 0 ? "live" : "seed";
  const teamSource: MarginProjectionSource = teamLive.length > 0 ? "live" : "seed";

  const models = await resolveLiveModels(pricing);

  return buildMarginProjection({
    pricing,
    personalPlans,
    teamPlans,
    personalYearPlans: personalYearLive.length > 0 ? personalYearLive : undefined,
    teamYearPlans: teamYearLive.length > 0 ? teamYearLive : undefined,
    personalSource,
    teamSource,
    models,
  });
}
