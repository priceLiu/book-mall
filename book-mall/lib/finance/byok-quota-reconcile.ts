/**
 * 将 ByokUsageMonthly.includedUsed 与 BillingSettlementLine（BYOK_QUOTA_INCLUDED）对齐；
 * 并按时间序重算每条结算行的 includedUsedAfter / includedRemainingAfter 快照。
 * 用于修复「结算流水写入失败导致 includedUsed 重复累加」的历史脏数据。
 */
import type { ByokTaskKind, CreditOwnerType } from "@prisma/client";

import { resolveByokScope } from "@/lib/billing/byok-overage-service";
import {
  BYOK_SCOPE_TEAM_SEAT,
  DEFAULT_BYOK_QUOTAS,
  normalizeByokFeeDescription,
  normalizeByokQuotaSettlementSnapshot,
} from "@/lib/billing/byok-pricing";
import { prisma } from "@/lib/prisma";

function currentPeriodKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type ByokQuotaReconcileRow = {
  ownerType: "USER" | "TENANT";
  ownerId: string;
  taskKind: ByokTaskKind;
  periodKey: string;
  beforeIncludedUsed: number;
  settlementCount: number;
  afterIncludedUsed: number;
};

/**  dryRun=true 时只报告，不写库。 */
export async function reconcileByokIncludedUsedFromSettlements(opts?: {
  periodKey?: string;
  dryRun?: boolean;
}): Promise<ByokQuotaReconcileRow[]> {
  const periodKey = opts?.periodKey ?? currentPeriodKey();
  const dryRun = opts?.dryRun ?? true;

  const settlements = await prisma.billingSettlementLine.groupBy({
    by: ["ownerType", "ownerId", "byokTaskKind"],
    where: {
      periodKey,
      settlementKind: "BYOK_QUOTA_INCLUDED",
      byokTaskKind: { not: null },
    },
    _count: { _all: true },
  });

  const out: ByokQuotaReconcileRow[] = [];

  for (const s of settlements) {
    if (!s.byokTaskKind) continue;
    const row = await prisma.byokUsageMonthly.findUnique({
      where: {
        ownerType_ownerId_periodKey_taskKind: {
          ownerType: s.ownerType,
          ownerId: s.ownerId,
          periodKey,
          taskKind: s.byokTaskKind,
        },
      },
    });
    const before = row?.includedUsed ?? 0;
    const target = s._count._all;
    if (before === target) continue;

    out.push({
      ownerType: s.ownerType,
      ownerId: s.ownerId,
      taskKind: s.byokTaskKind,
      periodKey,
      beforeIncludedUsed: before,
      settlementCount: target,
      afterIncludedUsed: target,
    });

    if (!dryRun && row) {
      await prisma.byokUsageMonthly.update({
        where: { id: row.id },
        data: { includedUsed: target },
      });
    }
  }

  return out;
}

export type ByokSettlementSnapshotFix = {
  settlementId: string;
  gatewayLogId: string;
  ownerType: CreditOwnerType;
  ownerId: string;
  byokTaskKind: ByokTaskKind;
  periodKey: string;
  submittedAt: Date;
  before: {
    monthlyIncluded: number | null;
    includedUsedAfter: number | null;
    includedRemainingAfter: number | null;
  };
  after: {
    monthlyIncluded: number;
    includedUsedAfter: number;
    includedRemainingAfter: number;
  };
};

async function resolveMonthlyIncludedLimit(
  ownerType: CreditOwnerType,
  ownerId: string,
  taskKind: ByokTaskKind,
): Promise<{ limit: number; seats: number }> {
  const ref = { ownerType, ownerId };
  const { scopeKey, seats } = await resolveByokScope(ref);
  const quota = await prisma.byokTaskQuota.findUnique({
    where: { scopeKey_taskKind: { scopeKey, taskKind } },
  });
  const perSeat =
    quota?.monthlyIncluded ??
    DEFAULT_BYOK_QUOTAS.find((q) => q.scopeKey === scopeKey && q.taskKind === taskKind)
      ?.monthlyIncluded ??
    0;
  const multiplier = scopeKey === BYOK_SCOPE_TEAM_SEAT ? seats : 1;
  return { limit: perSeat * multiplier, seats };
}

function patchFeeDescriptionRemaining(
  feeDescription: string | null | undefined,
  remaining: number,
  corrected: boolean,
): string {
  const base = feeDescription?.trim() ?? "";
  if (!base) return base;
  const withRemaining = /套餐剩余 \d+/.test(base)
    ? base.replace(/套餐剩余 \d+/, `套餐剩余 ${remaining}`)
    : `${base}，套餐剩余 ${remaining}`;
  return normalizeByokFeeDescription(withRemaining, corrected, remaining);
}

function groupSnapshotKey(
  ownerType: CreditOwnerType,
  ownerId: string,
  periodKey: string,
  taskKind: ByokTaskKind,
): string {
  return `${ownerType}:${ownerId}:${periodKey}:${taskKind}`;
}

export type SequentialQuotaSnapshotInput = {
  logId: string;
  submittedAt: Date;
  ownerType: CreditOwnerType;
  ownerId: string;
  periodKey: string;
  byokTaskKind: ByokTaskKind | null;
  settlementKind: string | null;
  quotaDelta: number | null;
  monthlyIncluded: number | null;
};

/**
 * 按 submittedAt 顺序重算 BYOK 套餐内「结算后已用 / 剩余」展示值（读时修正脏快照）。
 */
export function computeSequentialByokQuotaSnapshots(
  items: SequentialQuotaSnapshotInput[],
): Map<string, { includedUsedAfter: number; includedRemainingAfter: number }> {
  const groups = new Map<string, SequentialQuotaSnapshotInput[]>();

  for (const item of items) {
    if (item.settlementKind !== "BYOK_QUOTA_INCLUDED" || !item.byokTaskKind) continue;
    const key = groupSnapshotKey(
      item.ownerType,
      item.ownerId,
      item.periodKey,
      item.byokTaskKind,
    );
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }

  const out = new Map<
    string,
    { includedUsedAfter: number; includedRemainingAfter: number }
  >();

  for (const bucket of groups.values()) {
    bucket.sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
    const limit =
      bucket.find((b) => b.monthlyIncluded != null && b.monthlyIncluded > 0)
        ?.monthlyIncluded ?? 0;
    if (limit <= 0) continue;

    let runningUsed = 0;
    for (const item of bucket) {
      runningUsed += item.quotaDelta != null && item.quotaDelta > 0 ? item.quotaDelta : 1;
      out.set(item.logId, {
        includedUsedAfter: runningUsed,
        includedRemainingAfter: Math.max(0, limit - runningUsed),
      });
    }
  }

  return out;
}

/** 按 submittedAt 顺序重算 BYOK 套餐内结算行的 used/remaining 快照。dryRun=true 时只报告。 */
export async function reconcileByokSettlementSnapshots(opts?: {
  periodKey?: string;
  dryRun?: boolean;
}): Promise<ByokSettlementSnapshotFix[]> {
  const periodKey = opts?.periodKey;
  const dryRun = opts?.dryRun ?? true;

  const lines = await prisma.billingSettlementLine.findMany({
    where: {
      settlementKind: "BYOK_QUOTA_INCLUDED",
      byokTaskKind: { not: null },
      ...(periodKey ? { periodKey } : {}),
    },
    orderBy: [{ ownerType: "asc" }, { ownerId: "asc" }, { submittedAt: "asc" }],
    select: {
      id: true,
      gatewayLogId: true,
      ownerType: true,
      ownerId: true,
      periodKey: true,
      byokTaskKind: true,
      quotaDelta: true,
      monthlyIncluded: true,
      includedUsedAfter: true,
      includedRemainingAfter: true,
      feeDescription: true,
      submittedAt: true,
    },
  });

  const groups = new Map<string, typeof lines>();
  for (const line of lines) {
    if (!line.byokTaskKind) continue;
    const key = groupSnapshotKey(
      line.ownerType,
      line.ownerId,
      line.periodKey,
      line.byokTaskKind,
    );
    const bucket = groups.get(key);
    if (bucket) bucket.push(line);
    else groups.set(key, [line]);
  }

  const limitCache = new Map<string, { limit: number; seats: number }>();
  const fixes: ByokSettlementSnapshotFix[] = [];

  for (const [, bucket] of groups) {
    const sample = bucket[0]!;
    const taskKind = sample.byokTaskKind!;
    const limitKey = `${sample.ownerType}:${sample.ownerId}:${taskKind}`;
    let quotaMeta = limitCache.get(limitKey);
    if (!quotaMeta) {
      quotaMeta = await resolveMonthlyIncludedLimit(
        sample.ownerType,
        sample.ownerId,
        taskKind,
      );
      limitCache.set(limitKey, quotaMeta);
    }
    const { limit: baseLimit, seats } = quotaMeta;

    let runningUsed = 0;
    for (const line of bucket) {
      runningUsed += line.quotaDelta > 0 ? line.quotaDelta : 1;
      const snap = normalizeByokQuotaSettlementSnapshot({
        byokTaskKind: taskKind,
        ownerType: line.ownerType,
        monthlyIncluded: line.monthlyIncluded ?? baseLimit,
        includedUsedAfter: runningUsed,
        includedRemainingAfter: null,
        seats,
      });
      const expectedMonthlyIncluded = snap.monthlyIncluded ?? baseLimit;
      const expectedUsed = runningUsed;
      const expectedRemaining =
        snap.includedRemainingAfter ??
        Math.max(0, expectedMonthlyIncluded - expectedUsed);

      const needsFix =
        line.monthlyIncluded !== expectedMonthlyIncluded ||
        line.includedUsedAfter !== expectedUsed ||
        line.includedRemainingAfter !== expectedRemaining;

      if (!needsFix) continue;

      const fix: ByokSettlementSnapshotFix = {
        settlementId: line.id,
        gatewayLogId: line.gatewayLogId,
        ownerType: line.ownerType,
        ownerId: line.ownerId,
        byokTaskKind: taskKind,
        periodKey: line.periodKey,
        submittedAt: line.submittedAt,
        before: {
          monthlyIncluded: line.monthlyIncluded,
          includedUsedAfter: line.includedUsedAfter,
          includedRemainingAfter: line.includedRemainingAfter,
        },
        after: {
          monthlyIncluded: expectedMonthlyIncluded,
          includedUsedAfter: expectedUsed,
          includedRemainingAfter: expectedRemaining,
        },
      };
      fixes.push(fix);

      if (!dryRun) {
        const feeDescription = patchFeeDescriptionRemaining(
          line.feeDescription,
          expectedRemaining,
          snap.corrected,
        );
        await prisma.$transaction([
          prisma.billingSettlementLine.update({
            where: { id: line.id },
            data: {
              monthlyIncluded: expectedMonthlyIncluded,
              includedUsedAfter: expectedUsed,
              includedRemainingAfter: expectedRemaining,
              feeDescription,
            },
          }),
          prisma.gatewayRequestLog.update({
            where: { id: line.gatewayLogId },
            data: {
              includedUsedAfter: expectedUsed,
              includedRemainingAfter: expectedRemaining,
            },
          }),
        ]);
      }
    }
  }

  return fixes;
}
