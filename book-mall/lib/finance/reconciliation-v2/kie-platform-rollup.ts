/**
 * KIE 平台侧：按 model + 月 汇总 Gateway 扣分（与 KIE 账单积分口径对齐）。
 */
import type { PlatformUsageLine } from "./types";
import { buildJoinKey } from "./billable-units";
import { KIE_CREDIT_YUAN } from "./kie-usage-v2-adapter";

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

/** 将 KIE 平台明细行 rollup 为「积分 CALL」口径，便于与 KIE usage_data 对账。 */
export function rollupKiePlatformLinesByCredits(
  platformLines: PlatformUsageLine[],
): PlatformUsageLine[] {
  const kieLines = platformLines.filter((p) => p.vendor === "kie");
  const agg = new Map<string, PlatformUsageLine>();

  for (const p of kieLines) {
    const joinKey = buildJoinKey({
      vendor: "kie",
      modelKey: p.modelKey,
      tierRaw: null,
      unitKind: "CALL",
      tokenDirection: "none",
      periodKey: p.periodKey,
    });

    const cur =
      agg.get(joinKey) ??
      ({
        vendor: "kie",
        joinKey,
        month: p.month,
        period: p.period,
        periodKey: p.periodKey,
        userId: p.userId,
        modelKey: p.modelKey,
        tierRaw: null,
        unitKind: "CALL",
        tokenDirection: "none",
        platformUnits: 0,
        listUnitYuan: KIE_CREDIT_YUAN,
        platformListYuan: 0,
        platformNetCostYuan: 0,
        platformCredits: 0,
        platformRevenueYuan: 0,
        callCount: 0,
        sampleLogIds: [],
      } satisfies PlatformUsageLine);

    cur.platformCredits += p.platformCredits;
    cur.platformRevenueYuan += p.platformRevenueYuan;
    cur.platformNetCostYuan += p.platformNetCostYuan;
    cur.callCount += p.callCount;
    cur.platformUnits = cur.platformCredits;
    cur.platformListYuan = round4(cur.platformUnits * KIE_CREDIT_YUAN);
    for (const id of p.sampleLogIds) {
      if (cur.sampleLogIds.length < 5 && !cur.sampleLogIds.includes(id)) {
        cur.sampleLogIds.push(id);
      }
    }
    if (!cur.userId && p.userId) cur.userId = p.userId;
    agg.set(joinKey, cur);
  }

  return [...agg.values()].sort((a, b) => b.platformListYuan - a.platformListYuan);
}
