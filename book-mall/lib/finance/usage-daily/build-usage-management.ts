import type { ReconciliationPeriod } from "@/lib/finance/reconciliation-v2/period-range";
import { normalizePeriod } from "@/lib/finance/reconciliation-v2/period-range";
import {
  aggregateGatewayDaily,
  pickGatewayRowsByDimension,
  rollupGatewayByDimensionKey,
} from "@/lib/finance/usage-daily/gateway-daily-aggregate";
import {
  aggregateDeepseekVendorDaily,
  type ParseDeepseekVendorDailyInput,
} from "@/lib/finance/usage-daily/deepseek-vendor-daily-aggregate";
import {
  compareDailyUsage,
  pickUsageAlerts,
} from "@/lib/finance/usage-daily/daily-reconcile";
import type {
  UsageManagementComparePayload,
  UsageManagementGatewayPayload,
  UsageManagementSummary,
} from "@/lib/finance/usage-daily/types";

function buildSummaryFromGateway(
  gatewayDaily: Awaited<ReturnType<typeof aggregateGatewayDaily>>,
): Pick<
  UsageManagementSummary,
  "gatewayRequestCount" | "gatewayFailedCount" | "gatewayEstimatedCostYuan"
> {
  const total = gatewayDaily.filter((r) => r.dimension === "TOTAL");
  return {
    gatewayRequestCount: total.reduce((s, r) => s + r.requestCount, 0),
    gatewayFailedCount: total.reduce((s, r) => s + r.failedCount, 0),
    gatewayEstimatedCostYuan:
      Math.round(total.reduce((s, r) => s + r.estimatedCostYuan, 0) * 1e4) / 1e4,
  };
}

export async function buildUsageManagementGateway(
  period: ReconciliationPeriod,
): Promise<UsageManagementGatewayPayload> {
  const p = normalizePeriod(period);
  const gatewayDaily = await aggregateGatewayDaily({
    period: p,
    providerKind: "DEEPSEEK",
  });
  const gwPart = buildSummaryFromGateway(gatewayDaily);

  return {
    period: p,
    summary: {
      ...gwPart,
      vendorRequestCount: 0,
      vendorCostYuan: 0,
      missingPlatformDays: 0,
      alertCount: 0,
    },
    gatewayDaily,
    platformByApp: rollupGatewayByDimensionKey(gatewayDaily, "APP"),
    byCredential: rollupGatewayByDimensionKey(gatewayDaily, "CREDENTIAL"),
    byModel: rollupGatewayByDimensionKey(gatewayDaily, "MODEL"),
  };
}

export async function buildUsageManagementCompare(
  input: ParseDeepseekVendorDailyInput,
): Promise<UsageManagementComparePayload & UsageManagementGatewayPayload> {
  const period = normalizePeriod(input.period);
  const [vendorDaily, gatewayDaily] = await Promise.all([
    Promise.resolve(
      aggregateDeepseekVendorDaily({
        costCsv: input.costCsv,
        amountCsv: input.amountCsv,
        period,
      }),
    ),
    aggregateGatewayDaily({ period, providerKind: "DEEPSEEK" }),
  ]);

  const dailyCompare = compareDailyUsage({ vendorDaily, gatewayDaily });
  const alerts = pickUsageAlerts(dailyCompare);

  const vendorRequestCount = vendorDaily.reduce((s, r) => s + r.requestCount, 0);
  const vendorCostYuan =
    Math.round(vendorDaily.reduce((s, r) => s + r.costYuan, 0) * 1e4) / 1e4;
  const gwPart = buildSummaryFromGateway(gatewayDaily);
  const missingPlatformDays = new Set(
    dailyCompare.filter((r) => r.status === "MISSING_PLATFORM").map((r) => r.day),
  ).size;

  return {
    period,
    vendorDaily,
    dailyCompare,
    alerts,
    gatewayDaily,
    platformByApp: rollupGatewayByDimensionKey(gatewayDaily, "APP"),
    byCredential: rollupGatewayByDimensionKey(gatewayDaily, "CREDENTIAL"),
    byModel: rollupGatewayByDimensionKey(gatewayDaily, "MODEL"),
    summary: {
      ...gwPart,
      vendorRequestCount,
      vendorCostYuan,
      missingPlatformDays,
      alertCount: alerts.length,
    },
  };
}

export { pickGatewayRowsByDimension, rollupGatewayByDimensionKey };
