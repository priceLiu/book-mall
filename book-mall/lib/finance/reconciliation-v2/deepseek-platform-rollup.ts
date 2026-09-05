/**
 * DeepSeek cost-only CSV：平台 input/output 行合并为 tokenDirection none，与 cost 账单 join。
 */
import { buildJoinKey } from "./billable-units";
import type { PlatformUsageLine, VendorBillLine } from "./types";

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

/** cost CSV 仅有金额、无 token 方向时，合并同 model 的平台 KTOKEN 行。 */
export function rollupDeepseekPlatformLinesForCostMatch(
  platformLines: PlatformUsageLine[],
  vendorLines: VendorBillLine[],
): PlatformUsageLine[] {
  const costOnly =
    vendorLines.length > 0 &&
    vendorLines.every((v) => v.tokenDirection === "none" && v.vendorUnits <= 0);
  if (!costOnly) return platformLines;

  const deepseek = platformLines.filter((p) => p.vendor === "deepseek");
  const other = platformLines.filter((p) => p.vendor !== "deepseek");
  const agg = new Map<string, PlatformUsageLine>();

  for (const p of deepseek) {
    if (p.unitKind !== "KTOKEN") {
      other.push(p);
      continue;
    }
    const joinKey = buildJoinKey({
      vendor: "deepseek",
      modelKey: p.modelKey,
      tierRaw: p.tierRaw,
      unitKind: "KTOKEN",
      tokenDirection: "none",
      periodKey: p.periodKey,
    });
    const cur =
      agg.get(joinKey) ??
      ({
        vendor: "deepseek",
        joinKey,
        month: p.month,
        period: p.period,
        periodKey: p.periodKey,
        userId: p.userId,
        modelKey: p.modelKey,
        tierRaw: p.tierRaw,
        unitKind: "KTOKEN",
        tokenDirection: "none",
        platformUnits: 0,
        listUnitYuan: 0,
        platformListYuan: 0,
        platformNetCostYuan: 0,
        platformCredits: 0,
        platformRevenueYuan: 0,
        callCount: 0,
        sampleLogIds: [],
      } satisfies PlatformUsageLine);

    cur.platformUnits += p.platformUnits;
    cur.platformListYuan += p.platformListYuan;
    cur.platformNetCostYuan += p.platformNetCostYuan;
    cur.platformCredits += p.platformCredits;
    cur.platformRevenueYuan += p.platformRevenueYuan;
    cur.callCount += p.callCount;
    if (cur.listUnitYuan <= 0 && p.listUnitYuan > 0) cur.listUnitYuan = p.listUnitYuan;
    for (const id of p.sampleLogIds) {
      if (cur.sampleLogIds.length < 5 && !cur.sampleLogIds.includes(id)) {
        cur.sampleLogIds.push(id);
      }
    }
    if (!cur.userId && p.userId) cur.userId = p.userId;
    agg.set(joinKey, cur);
  }

  const rolled = [...agg.values()].map((l) => ({
    ...l,
    platformUnits: 0,
    platformListYuan: round4(l.platformListYuan),
    platformNetCostYuan: round4(l.platformNetCostYuan),
    platformRevenueYuan: round4(l.platformRevenueYuan),
  }));

  return [...other, ...rolled].sort((a, b) => b.platformListYuan - a.platformListYuan);
}
