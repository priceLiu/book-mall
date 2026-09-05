/**
 * 平台驾驶舱 · 本月经营三角：应付厂商净成本 / 用户实收 / 毛利。
 * 口径与 P&L 报表一致（CreditLedger 实收 + Gateway 净成本快照 × 用量）。
 */
import { buildPnlReport } from "@/lib/billing/pnl-report";
import { estimateGatewayLogNetCostYuan } from "@/lib/finance/gateway-log-line-cost";
import { loadModelCatalogBillMaps } from "@/lib/finance/gateway-bill-projection";
import { resolveBillingVendorLabel } from "@/lib/finance/billing-vendor-label";
import {
  currentPeriodKey,
  periodBounds,
  recentPeriodKeys,
} from "@/lib/finance/team-finance-guard";
import { GATEWAY_USAGE_LOG_SELECT } from "@/lib/gateway/gateway-token-usage-aggregate";
import { prisma } from "@/lib/prisma";

/** 驾驶舱厂商分组扫描上限（避免长查询占满连接池） */
const COCKPIT_FINANCE_LOG_CAP = 2500;

export type CockpitVendorFinanceRow = {
  vendorKey: string;
  vendorLabel: string;
  costYuan: number;
  revenueYuan: number;
  profitYuan: number;
  consumeCredits: number;
  callCount: number;
};

export type CockpitFinanceKpis = {
  periodKey: string;
  periodMonth: string;
  vendorCostYuan: number;
  platformRevenueYuan: number;
  profitYuan: number;
  marginRate: number | null;
  consumeCredits: number;
  succeededCalls: number;
  scannedCalls: number;
  truncated: boolean;
  byVendor: CockpitVendorFinanceRow[];
};

function periodMonthFromKey(periodKey: string): string {
  return periodKey.replace("-", "");
}

const PERIOD_KEY_RE = /^\d{4}-\d{2}$/;

/** 校验并归一化账期（YYYY-MM）；非法则回退当月 */
export function resolveCockpitFinancePeriodKey(
  periodKey?: string | null,
  now: Date = new Date(),
): string {
  const trimmed = periodKey?.trim();
  if (trimmed && PERIOD_KEY_RE.test(trimmed)) return trimmed;
  return currentPeriodKey(now);
}

export { recentPeriodKeys as cockpitFinancePeriodOptions };

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : fallback;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function buildCockpitFinanceKpis(input?: {
  periodKey?: string;
  now?: Date;
}): Promise<CockpitFinanceKpis> {
  const now = input?.now ?? new Date();
  const periodKey = resolveCockpitFinancePeriodKey(input?.periodKey, now);
  const periodMonth = periodMonthFromKey(periodKey);
  const { from: since, to: until } = periodBounds(periodKey);

  const logWhere = {
    status: "SUCCEEDED" as const,
    billingMode: "PLATFORM_CREDIT" as const,
    submittedAt: { gte: since, lt: until },
  };

  const [pnl, totalCalls, logs] = await Promise.all([
    buildPnlReport(periodKey),
    prisma.gatewayRequestLog.count({ where: logWhere }),
    prisma.gatewayRequestLog.findMany({
      where: logWhere,
      select: {
        ...GATEWAY_USAGE_LOG_SELECT,
        costSnapshotYuan: true,
        estimatedVendorCostYuan: true,
        creditsCharged: true,
        canonicalModelKey: true,
        model: true,
        actorBookUserId: true,
      },
      orderBy: { submittedAt: "desc" },
      take: COCKPIT_FINANCE_LOG_CAP,
    }),
  ]);

  const modelKeys = logs.map((g) => g.canonicalModelKey ?? g.model ?? "").filter(Boolean);
  const { vendors: catalogVendors } = await loadModelCatalogBillMaps(modelKeys, prisma);

  const ppcCache = new Map<string, number>();
  async function pricePerCreditForUser(userId: string | null | undefined): Promise<number> {
    const key = userId ?? "_default";
    if (ppcCache.has(key)) return ppcCache.get(key)!;
    let ppc = 0.04;
    if (userId) {
      const acct = await prisma.creditAccount.findFirst({
        where: { ownerType: "USER", ownerId: userId },
        select: { pricePerCreditYuan: true },
      });
      if (acct?.pricePerCreditYuan != null) ppc = num(acct.pricePerCreditYuan);
    }
    ppcCache.set(key, ppc);
    return ppc;
  }

  type VendorAgg = {
    vendorKey: string;
    vendorLabel: string;
    costYuan: number;
    revenueYuan: number;
    consumeCredits: number;
    callCount: number;
  };
  const byVendorMap = new Map<string, VendorAgg>();

  for (const log of logs) {
    const modelKey = log.canonicalModelKey ?? log.model ?? "";
    const catalogVendor = catalogVendors.get(modelKey) ?? null;
    const vendorLabel = resolveBillingVendorLabel(modelKey, catalogVendor);
    const vendorKey = (catalogVendor?.trim() || vendorLabel).toLowerCase() || "unknown";

    const cost = estimateGatewayLogNetCostYuan(log);
    const credits = num(log.creditsCharged);
    const ppc = await pricePerCreditForUser(log.actorBookUserId);
    const revenue = credits * ppc;

    const cur = byVendorMap.get(vendorKey) ?? {
      vendorKey,
      vendorLabel,
      costYuan: 0,
      revenueYuan: 0,
      consumeCredits: 0,
      callCount: 0,
    };
    cur.costYuan += cost;
    cur.revenueYuan += revenue;
    cur.consumeCredits += credits;
    cur.callCount += 1;
    byVendorMap.set(vendorKey, cur);
  }

  const byVendor: CockpitVendorFinanceRow[] = Array.from(byVendorMap.values())
    .map((v) => ({
      vendorKey: v.vendorKey,
      vendorLabel: v.vendorLabel,
      costYuan: round2(v.costYuan),
      revenueYuan: round2(v.revenueYuan),
      profitYuan: round2(v.revenueYuan - v.costYuan),
      consumeCredits: v.consumeCredits,
      callCount: v.callCount,
    }))
    .sort((a, b) => b.costYuan - a.costYuan || b.revenueYuan - a.revenueYuan);

  const vendorCostYuan = round2(pnl.costYuan);
  const platformRevenueYuan = round2(pnl.revenueYuan);
  const profitYuan = round2(platformRevenueYuan - vendorCostYuan);
  const marginRate =
    platformRevenueYuan > 0 ? round2(profitYuan / platformRevenueYuan) : null;

  return {
    periodKey,
    periodMonth,
    vendorCostYuan,
    platformRevenueYuan,
    profitYuan,
    marginRate,
    consumeCredits: pnl.consumeCredits,
    succeededCalls: totalCalls,
    scannedCalls: logs.length,
    truncated: totalCalls > logs.length,
    byVendor,
  };
}
