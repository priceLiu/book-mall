/**
 * 阿里云对账 v2 — 编排：CSV → 聚合 → reconcile → 入库。
 */
import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { syncVendorListPricesFromBillLines } from "@/lib/pricing/sync-vendor-list-cost-profile";

import { parseAliyunConsumedetailCsv } from "./aliyun-consumedetail-v2-adapter";
import {
  enrichReconciliationLines,
  upsertReconciliationMasterLines,
} from "./master-table";
import { aggregatePlatformUsageForReconciliation } from "./platform-usage-aggregator";
import { countByStatus, reconcileVendorAndPlatform } from "./reconcile-engine";
import { buildJoinKey } from "./billable-units";
import type { ReconciliationV2Result, ReconciliationV2Summary } from "./types";
import type { ReconciliationPeriod } from "./period-range";

export type RunAliyunReconciliationOpts = {
  csvText: string;
  csvFilename: string;
  importedByUserId: string;
  rejectDuplicate?: boolean;
  priceMode?: "list" | "payable";
  toleranceRate?: number;
  period?: ReconciliationPeriod;
};

function dateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00+08:00`);
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

export async function runAliyunReconciliationV2(
  opts: RunAliyunReconciliationOpts,
): Promise<ReconciliationV2Result> {
  const sha = createHash("sha256").update(opts.csvText).digest("hex");

  if (!opts.rejectDuplicate) {
    const existing = await prisma.billingReconciliationRun.findUnique({
      where: { csvSha256: sha },
    });
    if (existing && existing.engineVersion === "v2") {
      return loadRunResult(existing.id);
    }
  } else {
    const dup = await prisma.billingReconciliationRun.findUnique({
      where: { csvSha256: sha },
      select: { id: true },
    });
    if (dup) throw new Error(`该 CSV 已上传过：runId=${dup.id}`);
  }

  const parsed = await parseAliyunConsumedetailCsv(opts.csvText, { period: opts.period });

  await syncVendorListPricesFromBillLines(parsed.lines, {
    publishedBy: "aliyun-reconciliation-v2",
  });

  const cloudAccountIds = [
    ...new Set(parsed.lines.map((l) => l.cloudAccountId).filter(Boolean)),
  ] as string[];

  const bindings = await prisma.cloudAccountBinding.findMany({
    where: { cloudAccountId: { in: cloudAccountIds } },
    select: { cloudAccountId: true, cloudAccountName: true, userId: true },
  });
  const bindingMap = new Map(bindings.map((b) => [b.cloudAccountId, b]));

  const unboundMap = new Map<
    string,
    { cloudAccountId: string; cloudAccountName: string | null; csvRowCount: number; vendorListYuan: number }
  >();
  for (const line of parsed.lines) {
    if (!line.cloudAccountId) continue;
    if (bindingMap.has(line.cloudAccountId)) continue;
    const cur = unboundMap.get(line.cloudAccountId) ?? {
      cloudAccountId: line.cloudAccountId,
      cloudAccountName: null,
      csvRowCount: 0,
      vendorListYuan: 0,
    };
    cur.csvRowCount += line.csvRowCount;
    cur.vendorListYuan += line.vendorListYuan;
    unboundMap.set(line.cloudAccountId, cur);
  }

  const boundUserIds = [...new Set(bindings.map((b) => b.userId))];
  const platformLines = await aggregatePlatformUsageForReconciliation({
    period: parsed.period,
    userIds: boundUserIds.length ? boundUserIds : undefined,
  });
  const aliyunPlatformLines = platformLines.filter((p) => p.vendor === "aliyun");

  const resultLines = reconcileVendorAndPlatform(parsed.lines, aliyunPlatformLines, {
    toleranceRate: opts.toleranceRate ?? 0.05,
  });

  const statusCounts = countByStatus(resultLines);
  const okCount = statusCounts.OK;
  const issueCount = resultLines.length - okCount;

  const summary: ReconciliationV2Summary = {
    engineVersion: "v2",
    vendor: "aliyun",
    priceMode: opts.priceMode ?? "list",
    csvRowCount: parsed.rows.length,
    monthsCovered: parsed.months,
    periodFrom: parsed.period.from,
    periodTo: parsed.period.to,
    periodKey: parsed.periodKey,
    boundUsers: boundUserIds.length,
    unboundCloudAccounts: [...unboundMap.values()],
    totalVendorListYuan: round4(resultLines.reduce((s, r) => s + r.vendorListYuan, 0)),
    totalPlatformListYuan: round4(resultLines.reduce((s, r) => s + r.platformListYuan, 0)),
    totalAmountDiffYuan: round4(
      resultLines.reduce((s, r) => s + r.amountDiffYuan, 0),
    ),
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
      vendor: "aliyun",
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
    importVendor: "aliyun",
    lines: resultLines,
  });

  const lines = await enrichReconciliationLines(resultLines);
  return { runId: run.id, summary, lines };
}

async function loadRunResult(runId: string): Promise<ReconciliationV2Result> {
  const run = await prisma.billingReconciliationRun.findUniqueOrThrow({
    where: { id: runId },
    include: { lines: true },
  });
  const summary = run.summary as unknown as ReconciliationV2Summary;
  const linesRaw = run.lines.map((l) => ({
    vendor: (l.vendor ?? "aliyun") as string,
    importVendor: run.vendor ?? "aliyun",
    joinKey:
      l.joinKey ??
      buildJoinKey({
        vendor: l.vendor ?? "aliyun",
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
    importVendor: run.vendor ?? "aliyun",
    lines: linesRaw,
  });

  const lines = await enrichReconciliationLines(linesRaw);
  return { runId: run.id, summary, lines };
}

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : fallback;
}

export { loadRunResult as loadReconciliationV2Run };
