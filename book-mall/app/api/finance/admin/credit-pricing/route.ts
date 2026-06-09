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
import { loadPricingConfig } from "@/lib/pricing/credit-pricing-engine";
import { prisma } from "@/lib/prisma";
import {
  previewCreditPriceAction,
  publishModelPriceAction,
  savePricingConfigAction,
  unpublishModelPriceAction,
} from "@/app/admin/finance/credit-billing-actions";

export async function OPTIONS(request: NextRequest) {
  return financeOptions(request);
}

export async function GET(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canViewFinanceCost(user.role)) {
    return financeForbidden(request, "积分报价仅财务管理员可见");
  }

  const [config, profiles, prices, plans] = await Promise.all([
    loadPricingConfig(),
    prisma.modelCostProfile.findMany({
      where: { active: true },
      orderBy: [{ canonicalModelKey: "asc" }, { channel: "asc" }],
    }),
    prisma.modelCreditPrice.findMany({ orderBy: { canonicalModelKey: "asc" } }),
    prisma.membershipPlan.findMany({
      where: { active: true },
      orderBy: [{ family: "asc" }, { interval: "asc" }, { sortOrder: "asc" }],
    }),
  ]);

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

  return financeJson(request, {
    config,
    models: [...byKey.values()].map((p) => ({
      canonicalModelKey: p.canonicalModelKey,
      vendor: p.vendor,
      channel: p.channel,
      unit: p.unit,
      tierRaw: p.tierRaw,
      listCostYuan: Number(p.listCostYuan),
      discountRate: Number(p.discountRate),
      netCostYuan: Number(p.netCostYuan),
    })),
    published: prices.map((p) => ({
      canonicalModelKey: p.canonicalModelKey,
      displayName: p.displayName,
      unit: p.unit,
      creditsPerUnit: p.creditsPerUnit,
      listPriceYuan: Number(p.listPriceYuan),
      baseMarginRate: Number(p.baseMarginRate),
      marginM: Number(p.marginM),
      active: p.active,
      publishedAt: p.publishedAt.toISOString(),
    })),
    plans: plans.map((p) => ({
      family: p.family,
      interval: p.interval,
      tier: p.tier,
      priceYuan: Number(p.priceYuan),
      monthlyCredits: p.monthlyCredits,
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await getFinanceSession();
  if (!user) return financeUnauthorized(request);
  if (!canManagePricing(user.role)) {
    return financeForbidden(request, "需要财务管理员权限");
  }

  const body = (await request.json()) as { action: string } & Record<string, unknown>;
  let result;
  switch (body.action) {
    case "saveConfig":
      result = await savePricingConfigAction(bodyToFormData(body));
      break;
    case "preview":
      result = await previewCreditPriceAction({
        listCostYuan: Number(body.listCostYuan),
        discountRate: Number(body.discountRate),
        marginM: body.marginM != null ? Number(body.marginM) : undefined,
      });
      break;
    case "publish":
      result = await publishModelPriceAction(bodyToFormData(body));
      break;
    case "unpublish":
      result = await unpublishModelPriceAction(bodyToFormData(body));
      break;
    default:
      return financeJson(request, { ok: false, error: `未知操作: ${body.action}` }, { status: 400 });
  }
  return financeJson(request, result, { status: result.ok ? 200 : 400 });
}
