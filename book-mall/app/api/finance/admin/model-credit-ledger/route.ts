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
  computeUnifiedChargeCredits,
} from "@/lib/pricing/credit-pricing-engine";
import { computeModelQuoteFromCostProfile } from "@/lib/pricing/unified-credit-formula";
import { videoBillableSeconds } from "@/lib/pricing/credit-pricing-formulas";
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

  const [config, profiles, prices] = await Promise.all([
    loadPricingConfig(),
    prisma.modelCostProfile.findMany({
      where: { active: true },
      orderBy: [{ canonicalModelKey: "asc" }, { channel: "asc" }],
    }),
    prisma.modelCreditPrice.findMany({ orderBy: { canonicalModelKey: "asc" } }),
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

  const priceByKey = new Map(prices.map((p) => [p.canonicalModelKey, p]));

  const rows = [...byKey.values()].map((p) => {
    const quote = computeModelQuoteFromCostProfile({
      canonicalModelKey: p.canonicalModelKey,
      vendor: p.vendor,
      displayName: p.canonicalModelKey,
      unit: p.unit,
      listCostYuan: toNum(p.listCostYuan),
      discountRate: toNum(p.discountRate),
      config,
    });
    const published = priceByKey.get(p.canonicalModelKey);
    const videoUnits =
      p.unit === "PER_SEC" ? videoBillableSeconds(null, config.defaultVideoSec) : null;
    const chargeCredits15 =
      p.unit === "PER_SEC"
        ? computeUnifiedChargeCredits({
            creditsPerUnit: quote.creditsPerUnit,
            units: videoUnits ?? config.defaultVideoSec,
          })
        : null;

    return {
      canonicalModelKey: p.canonicalModelKey,
      vendor: p.vendor,
      unit: p.unit,
      tierRaw: p.tierRaw,
      listCostYuan: toNum(p.listCostYuan),
      discountRate: toNum(p.discountRate),
      netCostYuan: quote.netCostYuan,
      marginM: quote.marginM,
      minGuard: quote.minGuard,
      computed: {
        listPriceYuan: quote.listPriceYuan,
        creditsPerUnit: quote.creditsPerUnit,
        baseMarginRate: quote.baseMarginRate,
        marginOk: quote.marginOk,
        chargeCredits15,
        netCost15s: quote.netCost15s,
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
              listCostYuan,
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
