/**
 * DeepSeek 对账 v2 — usage_data CSV → reconcile → 入库。
 */
import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { syncVendorListPricesFromBillLines } from "@/lib/pricing/sync-vendor-list-cost-profile";
import { DEEPSEEK_V4_LIST_PRICES } from "@/lib/pricing/deepseek-v4-pricing";

import { parseDeepseekUsageBillCsv } from "./deepseek-usage-v2-adapter";
import {
  enrichReconciliationLines,
  upsertReconciliationMasterLines,
} from "./master-table";
import { aggregatePlatformUsageForReconciliation } from "./platform-usage-aggregator";
import { countByStatus, reconcileVendorAndPlatform } from "./reconcile-engine";
import { buildJoinKey } from "./billable-units";
import type { ReconciliationV2Result, ReconciliationV2Summary } from "./types";
import type { ReconciliationPeriod } from "./period-range";

export type RunDeepseekReconciliationOpts = {
  csvText: string;
  csvFilename: string;
  importedByUserId: string;
  rejectDuplicate?: boolean;
  priceMode?: "list" | "payable";
  toleranceRate?: number;
  extraCsvText?: string;
  period?: ReconciliationPeriod;
};

function dateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00+08:00`);
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : fallback;
}

export async function runDeepseekReconciliationV2(
  opts: RunDeepseekReconciliationOpts,
): Promise<ReconciliationV2Result> {
  const sha = createHash("sha256")
    .update(opts.csvText)
    .update(opts.extraCsvText ?? "")
    .digest("hex");

  if (!opts.rejectDuplicate) {
    const existing = await prisma.billingReconciliationRun.findUnique({
      where: { csvSha256: sha },
    });
    if (existing && existing.engineVersion === "v2") {
      return loadDeepseekRunResult(existing.id);
    }
  } else {
    const dup = await prisma.billingReconciliationRun.findUnique({
      where: { csvSha256: sha },
      select: { id: true },
    });
    if (dup) throw new Error(`该账单已上传过：runId=${dup.id}`);
  }

  const parsed = await parseDeepseekUsageBillCsv(opts.csvText, {
    extraCsv: opts.extraCsvText,
    period: opts.period,
  });
  if (parsed.lines.length === 0) {
    throw new Error("DeepSeek 账单无有效用量行");
  }

  // 官方价表 + CSV 实测单价 → 成本档与积分
  const officialLines = DEEPSEEK_V4_LIST_PRICES.flatMap((row) => [
    {
      vendor: "deepseek" as const,
      joinKey: `official|${row.canonicalModelKey}|input`,
      month: "",
      period: parsed.period,
      periodKey: parsed.periodKey,
      cloudAccountId: null,
      modelKey: row.canonicalModelKey,
      tierRaw: null,
      unitKind: "KTOKEN" as const,
      tokenDirection: "input" as const,
      vendorUnits: 0,
      listUnitYuan: row.inputListCostYuan,
      vendorListYuan: 0,
      csvRowCount: 0,
    },
    {
      vendor: "deepseek" as const,
      joinKey: `official|${row.canonicalModelKey}|output`,
      month: "",
      period: parsed.period,
      periodKey: parsed.periodKey,
      cloudAccountId: null,
      modelKey: row.canonicalModelKey,
      tierRaw: null,
      unitKind: "KTOKEN" as const,
      tokenDirection: "output" as const,
      vendorUnits: 0,
      listUnitYuan: row.outputListCostYuan,
      vendorListYuan: 0,
      csvRowCount: 0,
    },
  ]);
  await syncVendorListPricesFromBillLines([...officialLines, ...parsed.lines], {
    publishedBy: "deepseek-reconciliation-v2",
  });

  const platformLines = (
    await aggregatePlatformUsageForReconciliation({ period: parsed.period })
  ).filter((p) => p.vendor === "deepseek");

  const resultLines = reconcileVendorAndPlatform(parsed.lines, platformLines, {
    toleranceRate: opts.toleranceRate ?? 0.05,
  });

  const statusCounts = countByStatus(resultLines);
  const okCount = statusCounts.OK;
  const issueCount = resultLines.length - okCount;

  const summary: ReconciliationV2Summary = {
    engineVersion: "v2",
    vendor: "deepseek",
    priceMode: opts.priceMode ?? "list",
    csvRowCount: parsed.rowCount,
    monthsCovered: parsed.months,
    periodFrom: parsed.period.from,
    periodTo: parsed.period.to,
    periodKey: parsed.periodKey,
    boundUsers: 0,
    unboundCloudAccounts: [],
    totalVendorListYuan: round4(resultLines.reduce((s, r) => s + r.vendorListYuan, 0)),
    totalPlatformListYuan: round4(resultLines.reduce((s, r) => s + r.platformListYuan, 0)),
    totalAmountDiffYuan: round4(resultLines.reduce((s, r) => s + r.amountDiffYuan, 0)),
    totalPlatformCredits: Math.round(resultLines.reduce((s, r) => s + r.platformCredits, 0)),
    totalPlatformRevenueYuan: round4(
      resultLines.reduce((s, r) => s + r.platformRevenueYuan, 0),
    ),
    okCount,
    issueCount,
    statusCounts,
  };

  const run = await prisma.billingReconciliationRun.create({
    data: {
      csvSha256: sha,
      csvFilename: opts.csvFilename,
      monthsCovered: parsed.months.join(","),
      periodFrom: dateOnly(parsed.period.from),
      periodTo: dateOnly(parsed.period.to),
      periodKey: parsed.periodKey,
      importedByUserId: opts.importedByUserId,
      summary: summary as unknown as Prisma.InputJsonValue,
      status: "READY",
      vendor: "deepseek",
      priceMode: opts.priceMode ?? "list",
      engineVersion: "v2",
      lines: {
        create: resultLines.map((r) => ({
          userId: r.userId,
          cloudAccountId: r.cloudAccountId,
          modelKey: r.modelKey,
          billingKind: r.unitKind,
          internalCount: Math.round(r.platformUnits),
          internalYuan: r.platformListYuan,
          cloudCount: Math.round(r.vendorUnits),
          cloudPayableYuan: r.vendorListYuan,
          diffYuan: r.amountDiffYuan,
          matchKind:
            r.reconStatus === "OK"
              ? "BOTH"
              : r.reconStatus === "MISSING_VENDOR"
                ? "INTERNAL_ONLY"
                : r.reconStatus === "MISSING_PLATFORM"
                  ? "CLOUD_ONLY"
                  : "BOTH",
          vendor: r.vendor,
          tierRaw: r.tierRaw,
          unitKind: r.unitKind,
          tokenDirection: r.tokenDirection,
          vendorUnits: r.vendorUnits,
          platformUnits: r.platformUnits,
          usageDiff: r.usageDiff,
          listUnitYuan: r.listUnitYuan,
          vendorListYuan: r.vendorListYuan,
          platformListYuan: r.platformListYuan,
          amountDiffYuan: r.amountDiffYuan,
          platformCredits: r.platformCredits,
          platformRevenueYuan: r.platformRevenueYuan,
          reconStatus: r.reconStatus,
          issueReason: r.issueReason,
          sampleLogIds: r.sampleLogIds,
          joinKey: r.joinKey,
          periodMonth: r.month,
        })),
      },
    },
  });

  await upsertReconciliationMasterLines({
    runId: run.id,
    importedAt: run.createdAt,
    importVendor: "deepseek",
    lines: resultLines,
  });

  const lines = await enrichReconciliationLines(resultLines);
  return { runId: run.id, summary, lines };
}

async function loadDeepseekRunResult(runId: string): Promise<ReconciliationV2Result> {
  const run = await prisma.billingReconciliationRun.findUniqueOrThrow({
    where: { id: runId },
    include: { lines: true },
  });
  const summary = run.summary as unknown as ReconciliationV2Summary;
  const importVendor = run.vendor ?? "deepseek";
  const linesRaw = run.lines.map((l) => ({
    vendor: (l.vendor ?? "deepseek") as string,
    importVendor,
    joinKey:
      l.joinKey ??
      buildJoinKey({
        vendor: l.vendor ?? "deepseek",
        modelKey: l.modelKey,
        tierRaw: l.tierRaw,
        unitKind: (l.unitKind ?? l.billingKind) as import("./types").UnitKind,
        tokenDirection: (l.tokenDirection ?? "none") as import("./types").TokenDirection,
        month: l.periodMonth ?? run.monthsCovered.split(",")[0] ?? "",
      }),
    month: l.periodMonth ?? run.monthsCovered.split(",")[0] ?? "",
    userId: l.userId,
    cloudAccountId: l.cloudAccountId,
    modelKey: l.modelKey,
    tierRaw: l.tierRaw,
    unitKind: (l.unitKind ?? l.billingKind) as import("./types").UnitKind,
    tokenDirection: (l.tokenDirection ?? "none") as import("./types").TokenDirection,
    vendorUnits: num(l.vendorUnits ?? l.cloudCount),
    platformUnits: num(l.platformUnits ?? l.internalCount),
    usageDiff: num(l.usageDiff),
    listUnitYuan: num(l.listUnitYuan),
    vendorListYuan: num(l.vendorListYuan ?? l.cloudPayableYuan),
    platformListYuan: num(l.platformListYuan ?? l.internalYuan),
    amountDiffYuan: num(l.amountDiffYuan ?? l.diffYuan),
    platformCredits: num(l.platformCredits),
    platformRevenueYuan: num(l.platformRevenueYuan),
    reconStatus: (l.reconStatus ?? "OK") as import("./types").ReconStatus,
    issueReason: l.issueReason,
    sampleLogIds: Array.isArray(l.sampleLogIds) ? (l.sampleLogIds as string[]) : [],
  }));

  await upsertReconciliationMasterLines({
    runId: run.id,
    importedAt: run.createdAt,
    importVendor,
    lines: linesRaw,
  });

  const lines = await enrichReconciliationLines(linesRaw);
  return { runId: run.id, summary, lines };
}
