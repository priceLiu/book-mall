import { NextRequest } from "next/server";

import { canManagePricing, canViewFinanceCost } from "@/lib/auth/permissions";
import { bodyToFormData } from "@/lib/finance/body-to-form-data";
import {
  financeForbidden,
  financeJson,
  financeOptions,
  financeUnauthorized,
  getFinanceSession,
} from "@/lib/finance/finance-api";
import {
  computeCreditPrice,
  loadPricingConfig,
  marginGuardForUnit,
  marginPassesGuard,
  resolveModelMarginM,
} from "@/lib/pricing/credit-pricing-engine";
import { computeTierCredits } from "@/lib/pricing/credit-pricing-formulas";
import { prisma } from "@/lib/prisma";
import {
  publishModelPriceAction,
  unpublishModelPriceAction,
} from "@/app/admin/finance/credit-billing-actions";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "积分换算仅财务管理员可见");
  }

  const [config, profiles, prices, defaultPlan] = await Promise.all([
    loadPricingConfig(),
    prisma.modelCostProfile.findMany({
      where: { active: true },
      orderBy: [{ canonicalModelKey: "asc" }, { channel: "asc" }],
    }),
    prisma.modelCreditPrice.findMany({ orderBy: { canonicalModelKey: "asc" } }),
    prisma.membershipPlan.findFirst({
      where: { family: "PERSONAL", interval: "MONTH", tier: "高级版", active: true },
      select: { priceYuan: true, monthlyCredits: true },
    }),
  ]);

  const defaultPpc =
    defaultPlan && defaultPlan.monthlyCredits > 0
      ? Number(defaultPlan.priceYuan) / defaultPlan.monthlyCredits
      : config.creditAnchorYuan;

  const rank: Record<string, number> = { CHANNEL: 0, RESELLER: 1, OWN: 2 };
  const byKey = new Map<string, (typeof profiles)[number]>();
  for (const p of profiles) {
    const cur = byKey.get(p.canonicalModelKey);
    if (
      !cur ||
      (rank[p.channel] ?? 9) < (rank[cur.channel] ?? 9) ||
      ((rank[p.channel] ?? 9) === (rank[cur.channel] ?? 9) &&
        Number(p.netCostYuan) < Number(cur.netCostYuan))
    ) {
      byKey.set(p.canonicalModelKey, p);
    }
  }

  const priceByKey = new Map(prices.map((p) => [p.canonicalModelKey, p]));

  const rows = [...byKey.values()].map((p) => {
    const netCostYuan = toNum(p.netCostYuan);
    const marginM = resolveModelMarginM({
      unit: p.unit,
      netCostYuan,
      defaultMarginM: config.defaultMarginM,
      videoMarginM: config.videoMarginM,
    });
    const minGuard = marginGuardForUnit(p.unit, config);
    const comp = computeCreditPrice({
      listCostYuan: toNum(p.listCostYuan),
      discountRate: toNum(p.discountRate),
      marginM,
      anchorYuan: config.creditAnchorYuan,
    });
    const published = priceByKey.get(p.canonicalModelKey);
    const videoCredits15Anchor =
      p.unit === "PER_SEC"
        ? Math.round(comp.creditsPerUnit * config.defaultVideoSec)
        : null;
    const tierVideoCredits15 =
      p.unit === "PER_SEC"
        ? computeTierCredits(comp.listPriceYuan * config.defaultVideoSec, defaultPpc)
        : null;

    return {
      canonicalModelKey: p.canonicalModelKey,
      vendor: p.vendor,
      unit: p.unit,
      tierRaw: p.tierRaw,
      listCostYuan: toNum(p.listCostYuan),
      discountRate: toNum(p.discountRate),
      netCostYuan,
      marginM,
      minGuard,
      computed: {
        listPriceYuan: comp.listPriceYuan,
        creditsPerUnit: comp.creditsPerUnit,
        baseMarginRate: comp.baseMarginRate,
        marginOk: marginPassesGuard(comp.baseMarginRate, minGuard),
        videoCredits15Anchor,
        tierVideoCredits15,
      },
      published: published
        ? {
            displayName: published.displayName,
            creditsPerUnit: published.creditsPerUnit,
            listPriceYuan: Number(published.listPriceYuan),
            baseMarginRate: Number(published.baseMarginRate),
            marginM: Number(published.marginM),
            active: published.active,
            publishedAt: published.publishedAt.toISOString(),
          }
        : null,
    };
  });

  return financeJson(request, { config, rows });
}

export async function POST(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canManagePricing(user.role)) {
    return financeForbidden(request, "需要财务管理员权限");
  }

  const body = (await request.json()) as { action: string } & Record<string, unknown>;

  switch (body.action) {
    case "preview": {
      const config = await loadPricingConfig();
      const listCostYuan = Number(body.listCostYuan);
      const discountRate = Number(body.discountRate ?? 0);
      const unit = String(body.unit ?? "PER_IMAGE");
      const netCostYuan = listCostYuan * (1 - Math.min(Math.max(discountRate, 0), 1));
      const marginM =
        body.marginM != null
          ? Number(body.marginM)
          : resolveModelMarginM({
              unit,
              netCostYuan,
              defaultMarginM: config.defaultMarginM,
              videoMarginM: config.videoMarginM,
            });
      const comp = computeCreditPrice({
        listCostYuan,
        discountRate,
        marginM,
        anchorYuan: config.creditAnchorYuan,
      });
      const minGuard = marginGuardForUnit(unit, config);
      return financeJson(request, {
        ok: true,
        ...comp,
        marginM,
        minGuard,
        marginOk: marginPassesGuard(comp.baseMarginRate, minGuard),
      });
    }
    case "publish": {
      const result = await publishModelPriceAction(bodyToFormData(body));
      return financeJson(request, result, { status: result.ok ? 200 : 400 });
    }
    case "unpublish": {
      const result = await unpublishModelPriceAction(bodyToFormData(body));
      return financeJson(request, result, { status: result.ok ? 200 : 400 });
    }
    default:
      return financeJson(request, { ok: false, error: `未知操作: ${body.action}` }, { status: 400 });
  }
}
