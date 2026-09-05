/**
 * 厂商日用量 vs Gateway 日用量对比（DeepSeek 多 Key）。
 */
import type { ReconStatus } from "@/lib/finance/reconciliation-v2/types";
import { rollupVendorDailyByChannel } from "@/lib/finance/usage-daily/deepseek-vendor-daily-aggregate";
import type { GatewayDailyRow } from "@/lib/finance/usage-daily/types";
import type { DailyCompareRow, VendorDailyRow } from "@/lib/finance/usage-daily/types";

const DEFAULT_TOLERANCE_RATE = 0.05;

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

function resolveCompareStatus(
  vendorRequests: number,
  gatewayRequests: number,
  vendorCost: number,
  gatewayCost: number,
  toleranceRate: number,
): { status: ReconStatus; issueReason: string | null } {
  if (vendorRequests > 0 && gatewayRequests <= 0) {
    return {
      status: "MISSING_PLATFORM",
      issueReason: "厂商有请求，Gateway 无记录（可能直连或 Key 未走 Gateway）",
    };
  }
  if (gatewayRequests > 0 && vendorRequests <= 0) {
    return {
      status: "MISSING_VENDOR",
      issueReason: "Gateway 有成功记录，厂商 CSV 无对应用量",
    };
  }
  if (vendorRequests <= 0 && gatewayRequests <= 0) {
    return { status: "OK", issueReason: null };
  }

  const reqBase = Math.max(vendorRequests, gatewayRequests, 1);
  const reqDiffRate = Math.abs(vendorRequests - gatewayRequests) / reqBase;
  const costBase = Math.max(vendorCost, gatewayCost, 0.0001);
  const costDiffRate = Math.abs(vendorCost - gatewayCost) / costBase;

  if (reqDiffRate <= toleranceRate && costDiffRate <= toleranceRate) {
    return { status: "OK", issueReason: null };
  }
  if (gatewayRequests > vendorRequests) {
    return {
      status: "OVER_PLATFORM",
      issueReason: `Gateway 请求数高于厂商 ${gatewayRequests - vendorRequests}`,
    };
  }
  return {
    status: "UNDER_PLATFORM",
    issueReason: `Gateway 请求数低于厂商 ${vendorRequests - gatewayRequests}`,
  };
}

function rollupGatewayCredentialByDay(
  rows: GatewayDailyRow[],
): Map<string, GatewayDailyRow> {
  const map = new Map<string, GatewayDailyRow>();
  for (const r of rows) {
    if (r.dimension !== "CREDENTIAL") continue;
    const k = `${r.day}\0${r.dimensionKey}`;
    const cur = map.get(k);
    if (!cur) {
      map.set(k, { ...r });
      continue;
    }
    cur.requestCount += r.requestCount;
    cur.failedCount += r.failedCount;
    cur.promptTokens += r.promptTokens;
    cur.completionTokens += r.completionTokens;
    cur.estimatedCostYuan = round4(cur.estimatedCostYuan + r.estimatedCostYuan);
  }
  return map;
}

function rollupGatewayTotalByDay(rows: GatewayDailyRow[]): Map<string, GatewayDailyRow> {
  const map = new Map<string, GatewayDailyRow>();
  for (const r of rows) {
    if (r.dimension !== "TOTAL") continue;
    map.set(r.day, { ...r });
  }
  return map;
}

export type CompareDailyUsageInput = {
  vendorDaily: VendorDailyRow[];
  gatewayDaily: GatewayDailyRow[];
  toleranceRate?: number;
  /** true：按 channelKey 对比；false：仅按日 TOTAL */
  compareByChannel?: boolean;
};

export function compareDailyUsage(input: CompareDailyUsageInput): DailyCompareRow[] {
  const tolerance = input.toleranceRate ?? DEFAULT_TOLERANCE_RATE;
  const byChannel = input.compareByChannel !== false;

  const vendorByChannel = rollupVendorDailyByChannel(input.vendorDaily);
  const gatewayByCred = rollupGatewayCredentialByDay(input.gatewayDaily);
  const gatewayTotal = rollupGatewayTotalByDay(input.gatewayDaily);

  const vendorTotalByDay = new Map<string, { req: number; cost: number; inTok: number; outTok: number }>();
  for (const v of input.vendorDaily) {
    const cur = vendorTotalByDay.get(v.day) ?? { req: 0, cost: 0, inTok: 0, outTok: 0 };
    cur.req += v.requestCount;
    cur.cost += v.costYuan;
    cur.inTok += v.inputTokens;
    cur.outTok += v.outputTokens;
    vendorTotalByDay.set(v.day, cur);
  }

  const keys = new Set<string>();

  if (byChannel) {
    for (const k of vendorByChannel.keys()) keys.add(k);
    for (const k of gatewayByCred.keys()) keys.add(k);
  } else {
    for (const day of vendorTotalByDay.keys()) keys.add(`${day}\0TOTAL`);
    for (const day of gatewayTotal.keys()) keys.add(`${day}\0TOTAL`);
  }

  const rows: DailyCompareRow[] = [];

  for (const k of keys) {
    const [day, channelKey] = k.split("\0") as [string, string];

    let vendorRequests = 0;
    let vendorCost = 0;
    let vendorIn = 0;
    let vendorOut = 0;
    let gatewayRequests = 0;
    let gatewayCost = 0;
    let gatewayPrompt = 0;
    let gatewayCompletion = 0;

    if (byChannel && channelKey !== "TOTAL") {
      const v = vendorByChannel.get(k);
      const g = gatewayByCred.get(k);
      vendorRequests = v?.requestCount ?? 0;
      vendorCost = v?.costYuan ?? 0;
      vendorIn = v?.inputTokens ?? 0;
      vendorOut = v?.outputTokens ?? 0;
      gatewayRequests = g?.requestCount ?? 0;
      gatewayCost = g?.estimatedCostYuan ?? 0;
      gatewayPrompt = g?.promptTokens ?? 0;
      gatewayCompletion = g?.completionTokens ?? 0;
    } else {
      const vt = vendorTotalByDay.get(day);
      const gt = gatewayTotal.get(day);
      vendorRequests = vt?.req ?? 0;
      vendorCost = vt?.cost ?? 0;
      vendorIn = vt?.inTok ?? 0;
      vendorOut = vt?.outTok ?? 0;
      gatewayRequests = gt?.requestCount ?? 0;
      gatewayCost = gt?.estimatedCostYuan ?? 0;
      gatewayPrompt = gt?.promptTokens ?? 0;
      gatewayCompletion = gt?.completionTokens ?? 0;
    }

    const { status, issueReason } = resolveCompareStatus(
      vendorRequests,
      gatewayRequests,
      vendorCost,
      gatewayCost,
      tolerance,
    );

    rows.push({
      day,
      channelKey: byChannel && channelKey !== "TOTAL" ? channelKey : "TOTAL",
      vendorRequests,
      gatewayRequests,
      requestDiff: vendorRequests - gatewayRequests,
      vendorCostYuan: round4(vendorCost),
      gatewayCostYuan: round4(gatewayCost),
      costDiffYuan: round4(vendorCost - gatewayCost),
      vendorInputTokens: vendorIn,
      vendorOutputTokens: vendorOut,
      gatewayPromptTokens: gatewayPrompt,
      gatewayCompletionTokens: gatewayCompletion,
      status,
      issueReason,
    });
  }

  return rows.sort((a, b) =>
    a.day === b.day
      ? a.channelKey.localeCompare(b.channelKey)
      : a.day.localeCompare(b.day),
  );
}

export function pickUsageAlerts(rows: DailyCompareRow[]): DailyCompareRow[] {
  return rows.filter(
    (r) =>
      r.status === "MISSING_PLATFORM" ||
      r.status === "MISSING_VENDOR" ||
      r.status === "OVER_PLATFORM" ||
      r.status === "UNDER_PLATFORM",
  );
}
