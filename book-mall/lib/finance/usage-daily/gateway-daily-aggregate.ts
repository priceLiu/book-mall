/**
 * GatewayRequestLog → 按 CST 日 + 维度聚合（用量对账中心 · Gateway 侧真源）。
 */
import type { GatewayClientSource, GatewayProviderKind } from "@prisma/client";

import { clientPageToToolKey, clientPageToToolLabel } from "@/lib/finance/client-page-tool";
import { estimateGatewayLogNetCostYuan } from "@/lib/finance/gateway-log-line-cost";
import { GATEWAY_USAGE_LOG_SELECT } from "@/lib/gateway/gateway-token-usage-aggregate";
import {
  normalizeGatewayCredentialChannel,
  channelKeyLabel,
} from "@/lib/finance/usage-daily/key-normalize";
import type { GatewayDailyRow, UsageDailyDimension } from "@/lib/finance/usage-daily/types";
import {
  normalizePeriod,
  periodQueryBounds,
  type ReconciliationPeriod,
} from "@/lib/finance/reconciliation-v2/period-range";
import { prisma } from "@/lib/prisma";

function shanghaiDayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(d);
}

type AggBucket = {
  requestCount: number;
  failedCount: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCostYuan: number;
  dimensionLabel: string;
};

function bucketKey(day: string, dimension: UsageDailyDimension, dimensionKey: string): string {
  return `${day}\0${dimension}\0${dimensionKey}`;
}

function resolveAppKey(clientSource: GatewayClientSource, clientPage: string | null): string {
  const page = clientPage?.trim() ?? "";
  const toolKey = clientPageToToolKey(page);
  return `${clientSource}/${toolKey}`;
}

function resolveAppLabel(clientSource: GatewayClientSource, clientPage: string | null): string {
  const page = clientPage?.trim() ?? "";
  const label = clientPageToToolLabel(page);
  if (label !== "—") return `${clientSource} · ${label}`;
  return `${clientSource} · ${clientPageToToolKey(page)}`;
}

export type AggregateGatewayDailyInput = {
  period: ReconciliationPeriod;
  providerKind?: GatewayProviderKind;
};

export async function aggregateGatewayDaily(
  input: AggregateGatewayDailyInput,
): Promise<GatewayDailyRow[]> {
  const period = normalizePeriod(input.period);
  const { from, to } = periodQueryBounds(period);

  const logs = await prisma.gatewayRequestLog.findMany({
    where: {
      submittedAt: { gte: from, lte: to },
      ...(input.providerKind ? { providerKind: input.providerKind } : {}),
    },
    select: {
      ...GATEWAY_USAGE_LOG_SELECT,
      submittedAt: true,
      clientSource: true,
      channelSnapshot: true,
      credentialAliasSnapshot: true,
      costSnapshotYuan: true,
      estimatedVendorCostYuan: true,
    },
  });

  const buckets = new Map<string, AggBucket>();

  function touch(
    day: string,
    dimension: UsageDailyDimension,
    dimensionKey: string,
    dimensionLabel: string,
  ): AggBucket {
    const k = bucketKey(day, dimension, dimensionKey);
    let b = buckets.get(k);
    if (!b) {
      b = {
        requestCount: 0,
        failedCount: 0,
        promptTokens: 0,
        completionTokens: 0,
        estimatedCostYuan: 0,
        dimensionLabel,
      };
      buckets.set(k, b);
    }
    return b;
  }

  for (const log of logs) {
    const day = shanghaiDayKey(log.submittedAt);
    const succeeded = log.status === "SUCCEEDED";
    const cost = succeeded ? estimateGatewayLogNetCostYuan(log) : 0;
    const prompt = log.promptTokens ?? 0;
    const completion = log.completionTokens ?? 0;

    const inc = (dim: UsageDailyDimension, key: string, label: string) => {
      const b = touch(day, dim, key, label);
      if (succeeded) {
        b.requestCount += 1;
        b.promptTokens += prompt;
        b.completionTokens += completion;
        b.estimatedCostYuan += cost;
      } else {
        b.failedCount += 1;
      }
    };

    inc("TOTAL", "TOTAL", "合计");
    inc(
      "APP",
      resolveAppKey(log.clientSource, log.clientPage),
      resolveAppLabel(log.clientSource, log.clientPage),
    );
    const modelKey = (log.canonicalModelKey ?? log.model ?? "unknown").trim();
    inc("MODEL", modelKey, modelKey);
    const ch = normalizeGatewayCredentialChannel(
      log.channelSnapshot,
      log.credentialAliasSnapshot,
    );
    inc("CREDENTIAL", ch, channelKeyLabel(ch));
  }

  const rows: GatewayDailyRow[] = [];
  for (const [k, b] of buckets) {
    const [day, dimension, dimensionKey] = k.split("\0") as [
      string,
      UsageDailyDimension,
      string,
    ];
    rows.push({
      day,
      dimension,
      dimensionKey,
      dimensionLabel: b.dimensionLabel,
      requestCount: b.requestCount,
      failedCount: b.failedCount,
      promptTokens: b.promptTokens,
      completionTokens: b.completionTokens,
      estimatedCostYuan: Math.round(b.estimatedCostYuan * 1e4) / 1e4,
    });
  }

  return rows.sort((a, b) =>
    a.day === b.day
      ? a.dimension.localeCompare(b.dimension) || a.dimensionKey.localeCompare(b.dimensionKey)
      : a.day.localeCompare(b.day),
  );
}

export function pickGatewayRowsByDimension(
  rows: GatewayDailyRow[],
  dimension: UsageDailyDimension,
): GatewayDailyRow[] {
  return rows.filter((r) => r.dimension === dimension);
}

/** 跨日汇总同一 dimensionKey（用于「按应用」Tab）。 */
export function rollupGatewayByDimensionKey(
  rows: GatewayDailyRow[],
  dimension: UsageDailyDimension,
): GatewayDailyRow[] {
  const map = new Map<string, GatewayDailyRow>();
  for (const r of rows) {
    if (r.dimension !== dimension) continue;
    const cur = map.get(r.dimensionKey);
    if (!cur) {
      map.set(r.dimensionKey, { ...r, day: "" });
      continue;
    }
    cur.requestCount += r.requestCount;
    cur.failedCount += r.failedCount;
    cur.promptTokens += r.promptTokens;
    cur.completionTokens += r.completionTokens;
    cur.estimatedCostYuan =
      Math.round((cur.estimatedCostYuan + r.estimatedCostYuan) * 1e4) / 1e4;
  }
  return [...map.values()].sort((a, b) => b.requestCount - a.requestCount);
}
