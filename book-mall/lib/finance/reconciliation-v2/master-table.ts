/**
 * 对账总表 — 跨厂商、跨批次持久明细。
 * 每次厂商 CSV 导入成功后按 joinKey upsert；查询时可按月份/厂商/状态筛选。
 */
import type { Prisma } from "@prisma/client";

import {
  formatImportVendorLabel,
  resolveMasterLineVendor,
  appendCatalogMismatchReason,
} from "@/lib/finance/billing-vendor-label";
import { loadModelCatalogBillMaps } from "@/lib/finance/gateway-bill-projection";
import { prisma } from "@/lib/prisma";

import type { ReconciliationResultRow, ReconStatus } from "./types";
import type { PlatformUsageLine, VendorBillLine } from "./types";
import { aggregatePlatformUsageForReconciliation } from "./platform-usage-aggregator";
import { buildMasterUsageSummary, type MasterUsageSummary } from "./master-usage-summary";
import { reconcileVendorAndPlatform } from "./reconcile-engine";
import {
  normalizePeriod,
  periodKey as toPeriodKey,
  type ReconciliationPeriod,
} from "./period-range";

export type MasterLineDto = {
  joinKey: string;
  periodMonth: string;
  periodFrom: string | null;
  periodTo: string | null;
  periodKey: string | null;
  /** 对账厂商 code（joinKey 首段） */
  vendorCode: string;
  importVendor: string;
  /** 已上传 CSV 的厂商来源；空表示尚未导入厂商账单 */
  csvImportLabel: string | null;
  importVendorLabel: string;
  vendorDisplayName: string;
  modelKey: string;
  modelDisplayName: string;
  tierRaw: string | null;
  unitKind: string;
  tokenDirection: string;
  vendorUnits: number;
  platformUnits: number;
  usageDiff: number;
  listUnitYuan: number;
  vendorListYuan: number;
  platformListYuan: number;
  amountDiffYuan: number;
  platformCredits: number;
  platformRevenueYuan: number;
  platformNetCostYuan: number;
  /** 行级毛利 = 用户实收 − 预估净成本 */
  platformProfitYuan: number;
  reconStatus: ReconStatus;
  issueReason: string | null;
  sampleLogIds: string[];
  sourceRunId: string;
  sourceImportedAt: string;
  updatedAt: string;
};

export type MasterSummary = {
  lineCount: number;
  importVendors: string[];
  months: string[];
  periodFrom: string | null;
  periodTo: string | null;
  periodKey: string | null;
  totalVendorListYuan: number;
  totalPlatformListYuan: number;
  totalAmountDiffYuan: number;
  totalPlatformNetCostYuan: number;
  totalPlatformRevenueYuan: number;
  totalPlatformProfitYuan: number;
  /** 已导入厂商 CSV 行的挂牌差额合计 */
  totalReconciledAmountDiffYuan: number;
  totalPlatformCredits: number;
  okCount: number;
  issueCount: number;
  usage: MasterUsageSummary;
};

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : fallback;
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

function dateOnlyFromIso(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00+08:00`);
}

function isoDateFromDb(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function toRowData(
  line: ReconciliationResultRow,
  input: {
    runId: string;
    importedAt: Date;
    vendorDisplayName: string;
    modelDisplayName: string;
    importVendor?: string | null;
  },
): Prisma.BillingReconciliationMasterLineCreateInput {
  const billSource = (input.importVendor ?? line.importVendor ?? "").trim();
  const period = line.period?.from && line.period?.to ? normalizePeriod(line.period) : null;
  return {
    joinKey: line.joinKey,
    periodMonth: line.month,
    periodFrom: period ? dateOnlyFromIso(period.from) : null,
    periodTo: period ? dateOnlyFromIso(period.to) : null,
    periodKey: line.periodKey || (period ? toPeriodKey(period) : null),
    importVendor: billSource,
    vendorDisplayName: input.vendorDisplayName,
    modelKey: line.modelKey,
    modelDisplayName: input.modelDisplayName,
    tierRaw: line.tierRaw,
    unitKind: line.unitKind,
    tokenDirection: line.tokenDirection,
    userId: line.userId,
    cloudAccountId: line.cloudAccountId,
    vendorUnits: line.vendorUnits,
    platformUnits: line.platformUnits,
    usageDiff: line.usageDiff,
    listUnitYuan: line.listUnitYuan,
    vendorListYuan: line.vendorListYuan,
    platformListYuan: line.platformListYuan,
    amountDiffYuan: line.amountDiffYuan,
    platformCredits: Math.round(line.platformCredits),
    platformRevenueYuan: line.platformRevenueYuan,
    platformNetCostYuan: line.platformNetCostYuan,
    reconStatus: line.reconStatus,
    issueReason: line.issueReason,
    sampleLogIds: line.sampleLogIds,
    sourceRunId: input.runId,
    sourceImportedAt: input.importedAt,
  };
}

/** 导入成功后 upsert 总表明细（仅写入有厂商 CSV 数据的行）。 */
export async function upsertReconciliationMasterLines(input: {
  runId: string;
  importedAt: Date;
  importVendor: string;
  lines: ReconciliationResultRow[];
}): Promise<number> {
  if (input.lines.length === 0) return 0;

  const billVendor = input.importVendor.trim();
  const lines = input.lines.filter(
    (l) => l.vendorUnits > 0 || l.reconStatus === "MISSING_PLATFORM",
  );
  if (lines.length === 0) return 0;

  const modelKeys = [...new Set(lines.map((l) => l.modelKey).filter(Boolean))];
  const { displayNames, vendors } = await loadModelCatalogBillMaps(modelKeys, prisma);

  let count = 0;
  for (const line of lines) {
    if (!line.joinKey) continue;
    const catalogVendor = vendors.get(line.modelKey);
    const vendorResolved = resolveMasterLineVendor({
      joinKey: line.joinKey,
      modelKey: line.modelKey,
      catalogVendor,
    });
    const vendorDisplayName = vendorResolved.vendorDisplayName;
    const modelDisplayName = displayNames.get(line.modelKey) ?? line.modelKey;
    const issueReason = appendCatalogMismatchReason(line.issueReason, {
      catalogVendor,
      vendorCode: vendorResolved.vendorCode,
      modelKey: line.modelKey,
    });
    const data = toRowData(
      { ...line, issueReason },
      {
        runId: input.runId,
        importedAt: input.importedAt,
        vendorDisplayName,
        modelDisplayName,
        importVendor: billVendor,
      },
    );

    await prisma.billingReconciliationMasterLine.upsert({
      where: { joinKey: line.joinKey },
      create: data,
      update: {
        periodMonth: data.periodMonth,
        periodFrom: data.periodFrom,
        periodTo: data.periodTo,
        periodKey: data.periodKey,
        importVendor: data.importVendor,
        vendorDisplayName: data.vendorDisplayName,
        modelKey: data.modelKey,
        modelDisplayName: data.modelDisplayName,
        tierRaw: data.tierRaw,
        unitKind: data.unitKind,
        tokenDirection: data.tokenDirection,
        userId: data.userId,
        cloudAccountId: data.cloudAccountId,
        vendorUnits: data.vendorUnits,
        platformUnits: data.platformUnits,
        usageDiff: data.usageDiff,
        listUnitYuan: data.listUnitYuan,
        vendorListYuan: data.vendorListYuan,
        platformListYuan: data.platformListYuan,
        amountDiffYuan: data.amountDiffYuan,
        platformCredits: data.platformCredits,
        platformRevenueYuan: data.platformRevenueYuan,
        platformNetCostYuan: data.platformNetCostYuan,
        reconStatus: data.reconStatus,
        issueReason: data.issueReason,
        sampleLogIds: data.sampleLogIds,
        sourceRunId: data.sourceRunId,
        sourceImportedAt: data.sourceImportedAt,
      },
    });
    count += 1;
  }
  return count;
}

const PLATFORM_BASELINE_RUN_PREFIX = "platform-baseline";

function masterRowToVendorLine(row: {
  joinKey: string;
  periodMonth: string;
  periodFrom: Date | null;
  periodTo: Date | null;
  periodKey: string | null;
  importVendor: string;
  cloudAccountId: string | null;
  modelKey: string;
  tierRaw: string | null;
  unitKind: string;
  tokenDirection: string;
  vendorUnits: unknown;
  listUnitYuan: unknown;
  vendorListYuan: unknown;
}): VendorBillLine | null {
  const vendorUnits = num(row.vendorUnits);
  const vendorListYuan = num(row.vendorListYuan);
  const importVendor = row.importVendor?.trim();
  if (!importVendor || (vendorUnits <= 0 && vendorListYuan <= 0)) return null;
  return {
    vendor: importVendor as VendorBillLine["vendor"],
    joinKey: row.joinKey,
    month: row.periodMonth,
    period:
      row.periodFrom && row.periodTo
        ? {
            from: isoDateFromDb(row.periodFrom as Date) ?? "",
            to: isoDateFromDb(row.periodTo as Date) ?? "",
          }
        : { from: "", to: "" },
    periodKey: row.periodKey ?? "",
    cloudAccountId: row.cloudAccountId,
    modelKey: row.modelKey,
    tierRaw: row.tierRaw,
    unitKind: row.unitKind as VendorBillLine["unitKind"],
    tokenDirection: row.tokenDirection as VendorBillLine["tokenDirection"],
    vendorUnits,
    listUnitYuan: num(row.listUnitYuan),
    vendorListYuan,
    csvRowCount: 0,
  };
}

/** 刷新平台底表：Gateway 聚合 → 总表 upsert；已导入厂商列保留并重算 diff。 */
export async function refreshPlatformMasterBaseline(input: {
  period: ReconciliationPeriod;
  userIds?: string[];
  toleranceRate?: number;
}): Promise<{ lineCount: number; period: ReconciliationPeriod; periodKey: string }> {
  const period = normalizePeriod(input.period);
  const pk = toPeriodKey(period);

  const platformLines = await aggregatePlatformUsageForReconciliation({
    period,
    userIds: input.userIds,
  });

  const importedAt = new Date();
  const runId = `${PLATFORM_BASELINE_RUN_PREFIX}:${pk}:${importedAt.getTime()}`;

  const modelKeys = [...new Set(platformLines.map((l) => l.modelKey).filter(Boolean))];
  const { displayNames, vendors } = await loadModelCatalogBillMaps(modelKeys, prisma);

  let count = 0;
  for (const p of platformLines) {
    const existing = await prisma.billingReconciliationMasterLine.findUnique({
      where: { joinKey: p.joinKey },
    });

    let resultLine: ReconciliationResultRow;
    const vendorStub = existing ? masterRowToVendorLine(existing) : null;
    if (vendorStub) {
      [resultLine] = reconcileVendorAndPlatform([vendorStub], [p], {
        toleranceRate: input.toleranceRate ?? 0.05,
      });
    } else {
      [resultLine] = reconcileVendorAndPlatform([], [p], {
        toleranceRate: input.toleranceRate ?? 0.05,
      });
    }

    const catalogVendor = vendors.get(resultLine.modelKey);
    const vendorResolved = resolveMasterLineVendor({
      joinKey: resultLine.joinKey,
      modelKey: resultLine.modelKey,
      catalogVendor,
    });
    const vendorDisplayName = vendorResolved.vendorDisplayName;
    const modelDisplayName = displayNames.get(resultLine.modelKey) ?? resultLine.modelKey;
    const issueReason = appendCatalogMismatchReason(resultLine.issueReason, {
      catalogVendor,
      vendorCode: vendorResolved.vendorCode,
      modelKey: resultLine.modelKey,
    });
    const data = toRowData(
      { ...resultLine, issueReason },
      {
        runId,
        importedAt,
        vendorDisplayName,
        modelDisplayName,
        importVendor: existing?.importVendor?.trim() || null,
      },
    );

    const importVendorOnUpdate =
      num(data.vendorUnits) > 0 ? (existing?.importVendor?.trim() ?? "") : "";

    await prisma.billingReconciliationMasterLine.upsert({
      where: { joinKey: p.joinKey },
      create: data,
      update: {
        periodMonth: data.periodMonth,
        periodFrom: data.periodFrom,
        periodTo: data.periodTo,
        periodKey: data.periodKey,
        importVendor: importVendorOnUpdate,
        vendorDisplayName: data.vendorDisplayName,
        modelDisplayName: data.modelDisplayName,
        tierRaw: data.tierRaw,
        unitKind: data.unitKind,
        tokenDirection: data.tokenDirection,
        userId: data.userId,
        cloudAccountId: data.cloudAccountId,
        vendorUnits: data.vendorUnits,
        platformUnits: data.platformUnits,
        usageDiff: data.usageDiff,
        listUnitYuan: data.listUnitYuan,
        vendorListYuan: data.vendorListYuan,
        platformListYuan: data.platformListYuan,
        amountDiffYuan: data.amountDiffYuan,
        platformCredits: data.platformCredits,
        platformRevenueYuan: data.platformRevenueYuan,
        platformNetCostYuan: data.platformNetCostYuan,
        reconStatus: data.reconStatus,
        issueReason: data.issueReason,
        sampleLogIds: data.sampleLogIds,
        sourceRunId: data.sourceRunId,
        sourceImportedAt: data.sourceImportedAt,
      },
    });
    count += 1;
  }

  return { lineCount: count, period, periodKey: pk };
}

function mapMasterRow(row: {
  joinKey: string;
  periodMonth: string;
  periodFrom: Date | null;
  periodTo: Date | null;
  periodKey: string | null;
  importVendor: string;
  vendorDisplayName: string | null;
  modelKey: string;
  modelDisplayName: string | null;
  tierRaw: string | null;
  unitKind: string;
  tokenDirection: string;
  vendorUnits: unknown;
  platformUnits: unknown;
  usageDiff: unknown;
  listUnitYuan: unknown;
  vendorListYuan: unknown;
  platformListYuan: unknown;
  amountDiffYuan: unknown;
  platformCredits: number | null;
  platformRevenueYuan: unknown;
  platformNetCostYuan: unknown;
  reconStatus: string | null;
  issueReason: string | null;
  sampleLogIds: unknown;
  sourceRunId: string;
  sourceImportedAt: Date;
  updatedAt: Date;
}): MasterLineDto {
  const vendorResolved = resolveMasterLineVendor({
    joinKey: row.joinKey,
    modelKey: row.modelKey,
  });
  const csvImport = row.importVendor?.trim() ?? "";
  return {
    joinKey: row.joinKey,
    periodMonth: row.periodMonth,
    periodFrom: isoDateFromDb(row.periodFrom),
    periodTo: isoDateFromDb(row.periodTo),
    periodKey: row.periodKey,
    vendorCode: vendorResolved.vendorCode,
    importVendor: row.importVendor,
    csvImportLabel: csvImport ? formatImportVendorLabel(csvImport) : null,
    importVendorLabel: vendorResolved.vendorDisplayName,
    vendorDisplayName: vendorResolved.vendorDisplayName,
    modelKey: row.modelKey,
    modelDisplayName: row.modelDisplayName ?? row.modelKey,
    tierRaw: row.tierRaw,
    unitKind: row.unitKind,
    tokenDirection: row.tokenDirection,
    vendorUnits: num(row.vendorUnits),
    platformUnits: num(row.platformUnits),
    usageDiff: num(row.usageDiff),
    listUnitYuan: num(row.listUnitYuan),
    vendorListYuan: num(row.vendorListYuan),
    platformListYuan: num(row.platformListYuan),
    amountDiffYuan: num(row.amountDiffYuan),
    platformCredits: row.platformCredits ?? 0,
    platformRevenueYuan: num(row.platformRevenueYuan),
    platformNetCostYuan: num(row.platformNetCostYuan),
    platformProfitYuan: round4(num(row.platformRevenueYuan) - num(row.platformNetCostYuan)),
    reconStatus: (row.reconStatus ?? "OK") as ReconStatus,
    issueReason: row.issueReason,
    sampleLogIds: Array.isArray(row.sampleLogIds) ? (row.sampleLogIds as string[]) : [],
    sourceRunId: row.sourceRunId,
    sourceImportedAt: row.sourceImportedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function queryReconciliationMasterTable(input: {
  period?: ReconciliationPeriod;
  periodKey?: string;
  /** @deprecated 用 period */
  month?: string;
  importVendor?: string;
  status?: ReconStatus;
  take?: number;
  skip?: number;
}): Promise<{ lines: MasterLineDto[]; total: number; summary: MasterSummary }> {
  const where: Prisma.BillingReconciliationMasterLineWhereInput = {};

  if (input.periodKey?.trim()) {
    where.periodKey = input.periodKey.trim();
  } else if (input.period?.from && input.period?.to) {
    const p = normalizePeriod(input.period);
    where.periodKey = toPeriodKey(p);
  } else if (input.month?.trim()) {
    where.periodMonth = input.month.trim();
  }
  if (input.importVendor?.trim()) where.importVendor = input.importVendor.trim();
  if (input.status) where.reconStatus = input.status;

  const take = Math.min(500, Math.max(1, input.take ?? 200));
  const skip = Math.max(0, input.skip ?? 0);

  const [rows, total, monthGroups, vendorGroups] = await Promise.all([
    prisma.billingReconciliationMasterLine.findMany({
      where,
      orderBy: [{ periodMonth: "desc" }, { amountDiffYuan: "asc" }],
      take,
      skip,
    }),
    prisma.billingReconciliationMasterLine.count({ where }),
    prisma.billingReconciliationMasterLine.groupBy({
      by: ["periodMonth"],
      where,
      _count: true,
      orderBy: { periodMonth: "desc" },
    }),
    prisma.billingReconciliationMasterLine.groupBy({
      by: ["importVendor"],
      where,
      _count: true,
    }),
  ]);

  const allForSummary =
    total <= take
      ? rows
      : await prisma.billingReconciliationMasterLine.findMany({
          where,
          select: {
            unitKind: true,
            vendorUnits: true,
            platformUnits: true,
            vendorListYuan: true,
            platformListYuan: true,
            amountDiffYuan: true,
            platformCredits: true,
            platformRevenueYuan: true,
            platformNetCostYuan: true,
            reconStatus: true,
          },
        });

  let totalVendorListYuan = 0;
  let totalPlatformListYuan = 0;
  let totalAmountDiffYuan = 0;
  let totalPlatformNetCostYuan = 0;
  let totalPlatformCredits = 0;
  let totalPlatformRevenueYuan = 0;
  let totalReconciledAmountDiffYuan = 0;
  let okCount = 0;
  for (const r of allForSummary) {
    const vendorList = num(r.vendorListYuan);
    const vendorUnits = num("vendorUnits" in r ? r.vendorUnits : 0);
    totalVendorListYuan += vendorList;
    totalPlatformListYuan += num(r.platformListYuan);
    totalAmountDiffYuan += num(r.amountDiffYuan);
    totalPlatformNetCostYuan += num(r.platformNetCostYuan);
    totalPlatformCredits += r.platformCredits ?? 0;
    totalPlatformRevenueYuan += num(r.platformRevenueYuan);
    if (vendorList > 0 || vendorUnits > 0) {
      totalReconciledAmountDiffYuan += num(r.amountDiffYuan);
    }
    if (r.reconStatus === "OK") okCount += 1;
  }

  const totalPlatformProfitYuan = round4(totalPlatformRevenueYuan - totalPlatformNetCostYuan);

  const usage = buildMasterUsageSummary(
    allForSummary.map((r) => ({
      unitKind: "unitKind" in r && r.unitKind ? String(r.unitKind) : "CALL",
      platformUnits: r.platformUnits,
      platformListYuan: r.platformListYuan,
      platformCredits: r.platformCredits,
    })),
  );
  usage.totalPlatformRevenueYuan = round4(totalPlatformRevenueYuan);

  const resolvedPeriod =
    input.period?.from && input.period?.to ? normalizePeriod(input.period) : null;
  const resolvedPeriodKey = input.periodKey?.trim()
    ? input.periodKey.trim()
    : resolvedPeriod
      ? toPeriodKey(resolvedPeriod)
      : null;

  const queryPeriod = resolvedPeriod;

  const summary: MasterSummary = {
    lineCount: total,
    importVendors: vendorGroups
      .map((g) => g.importVendor)
      .filter((v) => v.trim().length > 0),
    months: monthGroups.map((g) => g.periodMonth),
    periodFrom: queryPeriod?.from ?? isoDateFromDb(rows[0]?.periodFrom ?? null),
    periodTo: queryPeriod?.to ?? isoDateFromDb(rows[0]?.periodTo ?? null),
    periodKey: resolvedPeriodKey ?? rows[0]?.periodKey ?? null,
    totalVendorListYuan: round4(totalVendorListYuan),
    totalPlatformListYuan: round4(totalPlatformListYuan),
    totalAmountDiffYuan: round4(totalAmountDiffYuan),
    totalPlatformNetCostYuan: round4(totalPlatformNetCostYuan),
    totalPlatformCredits: Math.round(totalPlatformCredits),
    totalPlatformRevenueYuan: round4(totalPlatformRevenueYuan),
    totalPlatformProfitYuan,
    totalReconciledAmountDiffYuan: round4(totalReconciledAmountDiffYuan),
    okCount,
    issueCount: total - okCount,
    usage,
  };

  return {
    lines: rows.map(mapMasterRow),
    total,
    summary,
  };
}

/** 为单次对账结果行补充 ModelCatalog 厂商名与模型展示名。 */
export async function enrichReconciliationLines(
  lines: ReconciliationResultRow[],
): Promise<
  Array<
    ReconciliationResultRow & {
      vendorDisplayName: string;
      modelDisplayName: string;
      importVendorLabel: string;
    }
  >
> {
  const modelKeys = [...new Set(lines.map((l) => l.modelKey).filter(Boolean))];
  const { displayNames, vendors } = await loadModelCatalogBillMaps(modelKeys, prisma);
  return lines.map((line) => {
    const catalogVendor = vendors.get(line.modelKey);
    const vendorResolved = resolveMasterLineVendor({
      joinKey: line.joinKey,
      modelKey: line.modelKey,
      catalogVendor,
    });
    const issueReason = appendCatalogMismatchReason(line.issueReason, {
      catalogVendor,
      vendorCode: vendorResolved.vendorCode,
      modelKey: line.modelKey,
    });
    return {
      ...line,
      issueReason,
      vendorDisplayName: vendorResolved.vendorDisplayName,
      modelDisplayName: displayNames.get(line.modelKey) ?? line.modelKey,
      importVendorLabel: vendorResolved.vendorDisplayName,
    };
  });
}
