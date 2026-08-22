/**
 * KIE 对账 v2 — usage_data CSV/Excel → 积分汇总 → reconcile → 入库。
 */
import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { parseKieUsageBillCsv } from "./kie-usage-v2-adapter";
import { rollupKiePlatformLinesByCredits } from "./kie-platform-rollup";
import {
  enrichReconciliationLines,
  upsertReconciliationMasterLines,
} from "./master-table";
import { aggregatePlatformUsageForReconciliation } from "./platform-usage-aggregator";
import { countByStatus, reconcileVendorAndPlatform } from "./reconcile-engine";
import { buildJoinKey } from "./billable-units";
import { mapStoredReconciliationLine } from "./stored-run-lines";
import type { ReconciliationV2Result, ReconciliationV2Summary } from "./types";
import type { ReconciliationPeriod } from "./period-range";

export type RunKieReconciliationOpts = {
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

export async function runKieReconciliationV2(
  opts: RunKieReconciliationOpts,
): Promise<ReconciliationV2Result> {
  const sha = createHash("sha256").update(opts.csvText).digest("hex");

  if (!opts.rejectDuplicate) {
    const existing = await prisma.billingReconciliationRun.findUnique({
      where: { csvSha256: sha },
    });
    if (existing && existing.engineVersion === "v2") {
      return loadKieRunResult(existing.id);
    }
  } else {
    const dup = await prisma.billingReconciliationRun.findUnique({
      where: { csvSha256: sha },
      select: { id: true },
    });
    if (dup) throw new Error(`该账单已上传过：runId=${dup.id}`);
  }

  const parsed = await parseKieUsageBillCsv(opts.csvText, { period: opts.period });
  if (parsed.lines.length === 0) {
    throw new Error("KIE 账单无有效用量行（Credits Consumed > 0）");
  }

  const platformLines = await aggregatePlatformUsageForReconciliation({
    period: parsed.period,
  });
  const kiePlatformLines = rollupKiePlatformLinesByCredits(platformLines);

  const resultLines = reconcileVendorAndPlatform(parsed.lines, kiePlatformLines, {
    toleranceRate: opts.toleranceRate ?? 0.05,
  });

  const statusCounts = countByStatus(resultLines);
  const okCount = statusCounts.OK;
  const issueCount = resultLines.length - okCount;

  const summary: ReconciliationV2Summary = {
    engineVersion: "v2",
    vendor: "kie",
    priceMode: opts.priceMode ?? "list",
    csvRowCount: parsed.taskRowCount,
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
      vendor: "kie",
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
    importVendor: "kie",
    lines: resultLines,
  });

  const lines = await enrichReconciliationLines(resultLines);
  return { runId: run.id, summary, lines };
}

async function loadKieRunResult(runId: string): Promise<ReconciliationV2Result> {
  const run = await prisma.billingReconciliationRun.findUniqueOrThrow({
    where: { id: runId },
    include: { lines: true },
  });
  const summary = run.summary as unknown as ReconciliationV2Summary;
  const importVendor = run.vendor ?? "kie";
  const linesRaw = run.lines.map((l) =>
    mapStoredReconciliationLine(l, run, summary, importVendor),
  );

  await upsertReconciliationMasterLines({
    runId: run.id,
    importedAt: run.createdAt,
    importVendor,
    lines: linesRaw,
  });

  const lines = await enrichReconciliationLines(linesRaw);
  return { runId: run.id, summary, lines };
}
