/**
 * 对账 v2 — outer join 厂商行与平台行，计算 diff 与 reconStatus。
 */
import type {
  PlatformUsageLine,
  ReconciliationResultRow,
  ReconStatus,
  VendorBillLine,
} from "./types";

export type ReconcileEngineOptions = {
  toleranceRate?: number;
};

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

function relDiff(a: number, b: number): number {
  const denom = Math.max(Math.abs(a), Math.abs(b)) || 1;
  return Math.abs(a - b) / denom;
}

function deriveIssueReason(input: {
  status: ReconStatus;
  unitKind: string;
  usageDiff: number;
  vendorUnits: number;
  platformUnits: number;
}): string | null {
  const { status, unitKind, usageDiff, vendorUnits, platformUnits } = input;
  if (status === "OK") return null;
  if (status === "MISSING_PLATFORM") {
    return `厂商有 ${vendorUnits} ${unitKind}，Gateway 无对应成功日志`;
  }
  if (status === "MISSING_VENDOR") {
    return `Gateway 有 ${platformUnits} ${unitKind}，厂商 CSV 无对应行`;
  }
  if (status === "UNDER_PLATFORM" && unitKind === "AUDIO_SEC" && usageDiff < 0) {
    return "ASR 缺 audioDurationSec 或 resultSummary 未写音频秒数";
  }
  if (status === "UNDER_PLATFORM" && unitKind === "SEC") {
    return "视频成片秒未写入 resultSummary.usage.duration，或存在非 Gateway 调用";
  }
  if (status === "UNDER_PLATFORM" && unitKind === "KTOKEN" && usageDiff !== 0) {
    return "Token 计量与 CSV 不一致，或存在非 Gateway 调用";
  }
  if (status === "OVER_PLATFORM") {
    return `平台用量 ${platformUnits} 高于厂商 ${vendorUnits}`;
  }
  if (status === "PRICE_MISMATCH") {
    return "用量在容差内但挂牌单价不一致";
  }
  return null;
}

function resolveStatus(input: {
  vendorUnits: number;
  platformUnits: number;
  vendorListYuan: number;
  platformListYuan: number;
  listUnitYuanVendor: number;
  listUnitYuanPlatform: number;
  toleranceRate: number;
}): ReconStatus {
  const {
    vendorUnits,
    platformUnits,
    vendorListYuan,
    platformListYuan,
    listUnitYuanVendor,
    listUnitYuanPlatform,
    toleranceRate,
  } = input;

  if (vendorUnits <= 0 && platformUnits <= 0) return "OK";
  if (vendorUnits > 0 && platformUnits <= 0) return "MISSING_PLATFORM";
  if (platformUnits > 0 && vendorUnits <= 0) return "MISSING_VENDOR";

  const usageOk = relDiff(vendorUnits, platformUnits) <= toleranceRate;
  const amountOk = relDiff(vendorListYuan, platformListYuan) <= toleranceRate;

  if (usageOk && amountOk) return "OK";
  if (usageOk && !amountOk) {
    if (
      listUnitYuanVendor > 0 &&
      listUnitYuanPlatform > 0 &&
      relDiff(listUnitYuanVendor, listUnitYuanPlatform) > toleranceRate
    ) {
      return "PRICE_MISMATCH";
    }
    return platformListYuan > vendorListYuan ? "OVER_PLATFORM" : "UNDER_PLATFORM";
  }
  return platformUnits > vendorUnits ? "OVER_PLATFORM" : "UNDER_PLATFORM";
}

export function reconcileVendorAndPlatform(
  vendorLines: VendorBillLine[],
  platformLines: PlatformUsageLine[],
  opts: ReconcileEngineOptions = {},
): ReconciliationResultRow[] {
  const toleranceRate = opts.toleranceRate ?? 0.05;
  const vendorMap = new Map(vendorLines.map((l) => [l.joinKey, l]));
  const platformMap = new Map(platformLines.map((l) => [l.joinKey, l]));
  const allKeys = new Set([...vendorMap.keys(), ...platformMap.keys()]);
  const rows: ReconciliationResultRow[] = [];

  for (const joinKey of allKeys) {
    const v = vendorMap.get(joinKey);
    const p = platformMap.get(joinKey);
    const vendorUnits = v?.vendorUnits ?? 0;
    const platformUnits = p?.platformUnits ?? 0;
    const listUnitYuan = v?.listUnitYuan ?? p?.listUnitYuan ?? 0;
    const vendorListYuan = v?.vendorListYuan ?? round4(vendorUnits * listUnitYuan);
    // 挂牌对账：平台侧金额统一用 CSV 目录单价重算，避免 ModelCostProfile 与阿里 CSV 单价偏差
    const platformListYuan =
      listUnitYuan > 0 && platformUnits > 0
        ? round4(platformUnits * listUnitYuan)
        : (p?.platformListYuan ?? round4(platformUnits * listUnitYuan));
    const usageDiff = round4(platformUnits - vendorUnits);
    const amountDiffYuan = round4(platformListYuan - vendorListYuan);

    // 挂牌对账以厂商 CSV 单价为准；平台侧 profile 未同步前也应用同一单价判状态
    const authoritativeListUnit = v?.listUnitYuan ?? p?.listUnitYuan ?? 0;
    const reconStatus = resolveStatus({
      vendorUnits,
      platformUnits,
      vendorListYuan,
      platformListYuan,
      listUnitYuanVendor: authoritativeListUnit,
      listUnitYuanPlatform: authoritativeListUnit,
      toleranceRate,
    });

    const issueReason = deriveIssueReason({
      status: reconStatus,
      unitKind: v?.unitKind ?? p?.unitKind ?? "CALL",
      usageDiff,
      vendorUnits,
      platformUnits,
    });

    rows.push({
      vendor: v?.vendor ?? p?.vendor ?? joinKey.split("|")[0] ?? "unknown",
      importVendor: v?.vendor ?? null,
      joinKey,
      month: v?.month ?? p?.month ?? "",
      period: v?.period ?? p?.period ?? { from: "", to: "" },
      periodKey: v?.periodKey ?? p?.periodKey ?? joinKey.split("|")[5] ?? "",
      userId: p?.userId ?? null,
      cloudAccountId: v?.cloudAccountId ?? null,
      modelKey: v?.modelKey ?? p?.modelKey ?? "(unknown)",
      tierRaw: v?.tierRaw ?? p?.tierRaw ?? null,
      unitKind: v?.unitKind ?? p?.unitKind ?? "CALL",
      tokenDirection: v?.tokenDirection ?? p?.tokenDirection ?? "none",
      vendorUnits: round4(vendorUnits),
      platformUnits: round4(platformUnits),
      usageDiff,
      listUnitYuan: round4(listUnitYuan),
      vendorListYuan: round4(vendorListYuan),
      platformListYuan: round4(platformListYuan),
      amountDiffYuan,
      platformCredits: p?.platformCredits ?? 0,
      platformRevenueYuan: p?.platformRevenueYuan ?? 0,
      platformNetCostYuan: p?.platformNetCostYuan ?? 0,
      reconStatus,
      issueReason,
      sampleLogIds: p?.sampleLogIds ?? [],
    });
  }

  rows.sort((a, b) => Math.abs(b.amountDiffYuan) - Math.abs(a.amountDiffYuan));
  return rows;
}

export function countByStatus(rows: ReconciliationResultRow[]): Record<ReconStatus, number> {
  const out: Record<ReconStatus, number> = {
    OK: 0,
    OVER_PLATFORM: 0,
    UNDER_PLATFORM: 0,
    MISSING_PLATFORM: 0,
    MISSING_VENDOR: 0,
    PRICE_MISMATCH: 0,
    UNBOUND: 0,
  };
  for (const r of rows) out[r.reconStatus] += 1;
  return out;
}
