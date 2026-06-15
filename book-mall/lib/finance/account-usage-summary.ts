import { prisma } from "@/lib/prisma";
import { BYOK_TASK_KIND_LABEL } from "@/lib/billing/byok-pricing";
import {
  BILLING_CATEGORY_LABEL,
  BILLING_CATEGORY_ORDER,
  classifyBillingCategory,
  type BillingCategoryKey,
} from "@/lib/billing/billing-category";
import { buildGatewayLogActorWhere } from "@/lib/gateway/log-query-scope";
import { getPoolBalances } from "@/lib/billing/credit-account-service";
import {
  clientPageToToolKey,
  clientPageToToolLabel,
} from "@/lib/finance/client-page-tool";

function monthStartUtc(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function currentPeriodKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type PackageUsageRow = {
  key: string;
  label: string;
  /** 套餐内总额度；文字类无额度时为 null */
  total: number | null;
  /** BYOK 套餐内已扣次数（与「剩余」同一口径：剩余 = 总数 − 已用） */
  includedUsed: number | null;
  succeeded: number;
  failed: number;
  remaining: number | null;
  /** 平台代付：本月扣积分（BYOK 行通常为 null） */
  creditsConsumed?: number | null;
};

/** 平台代付：本月按七类消耗（次数 + 积分，无含次额度）。 */
export async function getAccountPlatformCategoryUsageRows(
  bookUserId: string,
): Promise<PackageUsageRow[]> {
  const since = monthStartUtc();
  const periodKey = currentPeriodKey();

  const [logs, settlements] = await Promise.all([
    prisma.gatewayRequestLog.findMany({
      where: buildGatewayLogActorWhere(bookUserId, {
        submittedFrom: since,
        statuses: ["SUCCEEDED", "FAILED"],
      }),
      select: { requestKind: true, status: true, inputSummary: true },
    }),
    prisma.billingSettlementLine.findMany({
      where: { actorBookUserId: bookUserId, periodKey },
      select: { billingCategory: true, creditsCharged: true },
    }),
  ]);

  const counts = new Map<BillingCategoryKey, { succeeded: number; failed: number }>();
  const creditsByCat = new Map<BillingCategoryKey, number>();

  for (const log of logs) {
    const cat = classifyBillingCategory(log);
    const row = counts.get(cat) ?? { succeeded: 0, failed: 0 };
    if (log.status === "SUCCEEDED") row.succeeded += 1;
    else row.failed += 1;
    counts.set(cat, row);
  }

  for (const s of settlements) {
    if (!s.billingCategory) continue;
    creditsByCat.set(
      s.billingCategory,
      (creditsByCat.get(s.billingCategory) ?? 0) + (s.creditsCharged ?? 0),
    );
  }

  return BILLING_CATEGORY_ORDER.map((cat) => {
    const c = counts.get(cat) ?? { succeeded: 0, failed: 0 };
    return {
      key: cat,
      label: BILLING_CATEGORY_LABEL[cat],
      total: null,
      includedUsed: null,
      succeeded: c.succeeded,
      failed: c.failed,
      remaining: null,
      creditsConsumed: creditsByCat.get(cat) ?? 0,
    };
  });
}

/** 个人中心概览：本月积分（区分轻量包加购 vs 套餐月发）+ 调用统计。 */
export async function getAccountUsageSummary(bookUserId: string) {
  const ref = { ownerType: "USER" as const, ownerId: bookUserId };
  const since = monthStartUtc();

  const account = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: ref },
    select: { id: true, planId: true, balanceCredits: true, videoBalanceCredits: true },
  });

  const user = await prisma.user.findUnique({
    where: { id: bookUserId },
    select: { billingPersona: true },
  });

  const [pools, topupAgg, grantAgg, adjustAgg, consumedAgg, totalCalls] = await Promise.all([
    getPoolBalances(ref),
    account
      ? prisma.creditLedger.aggregate({
          where: { accountId: account.id, createdAt: { gte: since }, type: "TOPUP" },
          _sum: { credits: true },
        })
      : Promise.resolve({ _sum: { credits: 0 } }),
    account
      ? prisma.creditLedger.aggregate({
          where: { accountId: account.id, createdAt: { gte: since }, type: "GRANT" },
          _sum: { credits: true },
        })
      : Promise.resolve({ _sum: { credits: 0 } }),
    account
      ? prisma.creditLedger.aggregate({
          where: { accountId: account.id, createdAt: { gte: since }, type: "ADJUST" },
          _sum: { credits: true },
        })
      : Promise.resolve({ _sum: { credits: 0 } }),
    account
      ? prisma.creditLedger.aggregate({
          where: {
            accountId: account.id,
            createdAt: { gte: since },
            type: { in: ["CONSUME", "SETTLE"] },
          },
          _sum: { credits: true },
        })
      : Promise.resolve({ _sum: { credits: 0 } }),
    prisma.gatewayRequestLog.count({
      where: buildGatewayLogActorWhere(bookUserId, {
        status: "SUCCEEDED",
        submittedFrom: since,
      }),
    }),
  ]);

  const topupRaw = Math.max(0, topupAgg._sum.credits ?? 0);
  let grantCreditsThisMonth = Math.max(0, grantAgg._sum.credits ?? 0);
  const adjustCreditsThisMonth = Math.max(0, adjustAgg._sum.credits ?? 0);
  const creditsConsumed = Math.abs(consumedAgg._sum.credits ?? 0);
  const creditsRemaining = pools.general.balance + pools.video.balance;

  if (user?.billingPersona === "BYOK" && !account?.planId) {
    grantCreditsThisMonth = 0;
  }

  const topupCreditsThisMonth = Math.min(
    topupRaw,
    Math.max(0, creditsRemaining + creditsConsumed),
  );

  const creditsGranted =
    topupCreditsThisMonth + grantCreditsThisMonth + adjustCreditsThisMonth;

  return {
    periodStart: since.toISOString(),
    creditsGranted,
    topupCreditsThisMonth,
    grantCreditsThisMonth,
    adjustCreditsThisMonth,
    creditsConsumed,
    creditsRemaining,
    generalBalance: pools.general.balance,
    videoBalance: pools.video.balance,
    totalCallsThisMonth: totalCalls,
  };
}

/** 套餐内任务使用情况（本月 Gateway 成功/失败 + BYOK 额度剩余）。 */
export async function getAccountPackageUsageRows(
  bookUserId: string,
  scopeKey: string | null,
): Promise<PackageUsageRow[]> {
  const since = monthStartUtc();
  const periodKey = currentPeriodKey();

  const [logs, quotas, usage, settlementCounts] = await Promise.all([
    prisma.gatewayRequestLog.findMany({
      where: buildGatewayLogActorWhere(bookUserId, {
        submittedFrom: since,
        statuses: ["SUCCEEDED", "FAILED"],
      }),
      select: { requestKind: true, status: true, inputSummary: true },
    }),
    scopeKey
      ? prisma.byokTaskQuota.findMany({
          where: { scopeKey, active: true },
          orderBy: { taskKind: "asc" },
        })
      : Promise.resolve([]),
    scopeKey
      ? prisma.byokUsageMonthly.findMany({
          where: { ownerType: "USER", ownerId: bookUserId, periodKey },
        })
      : Promise.resolve([]),
    scopeKey
      ? prisma.billingSettlementLine.groupBy({
          by: ["byokTaskKind"],
          where: {
            ownerType: "USER",
            ownerId: bookUserId,
            periodKey,
            settlementKind: "BYOK_QUOTA_INCLUDED",
            byokTaskKind: { not: null },
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const usageByKind = new Map(usage.map((u) => [u.taskKind, u]));
  const settlementByKind = new Map(
    settlementCounts.map((s) => [s.byokTaskKind!, s._count._all]),
  );
  const counts = new Map<BillingCategoryKey, { succeeded: number; failed: number }>();

  for (const log of logs) {
    const cat = classifyBillingCategory(log);
    const row = counts.get(cat) ?? { succeeded: 0, failed: 0 };
    if (log.status === "SUCCEEDED") row.succeeded += 1;
    else row.failed += 1;
    counts.set(cat, row);
  }

  const quotaRows: PackageUsageRow[] = await Promise.all(
    quotas.map(async (q) => {
      const c = counts.get(q.taskKind) ?? { succeeded: 0, failed: 0 };
      const usageRow = usageByKind.get(q.taskKind);
      const settlementUsed = settlementByKind.get(q.taskKind) ?? 0;
      const used = settlementUsed;
      if (usageRow && usageRow.includedUsed !== settlementUsed) {
        await prisma.byokUsageMonthly
          .update({
            where: { id: usageRow.id },
            data: { includedUsed: settlementUsed },
          })
          .catch(() => undefined);
      }
      return {
        key: q.taskKind,
        label: BYOK_TASK_KIND_LABEL[q.taskKind] ?? q.label,
        total: q.monthlyIncluded,
        includedUsed: used,
        succeeded: c.succeeded,
        failed: c.failed,
        remaining: Math.max(0, q.monthlyIncluded - used),
      };
    }),
  );

  const textCounts = counts.get("TEXT") ?? { succeeded: 0, failed: 0 };
  const otherCounts = counts.get("OTHER") ?? { succeeded: 0, failed: 0 };
  return [
    ...quotaRows,
    {
      key: "TEXT",
      label: BILLING_CATEGORY_LABEL.TEXT,
      total: null,
      includedUsed: null,
      succeeded: textCounts.succeeded,
      failed: textCounts.failed,
      remaining: null,
    },
    {
      key: "OTHER",
      label: BILLING_CATEGORY_LABEL.OTHER,
      total: null,
      includedUsed: null,
      succeeded: otherCounts.succeeded,
      failed: otherCounts.failed,
      remaining: null,
    },
  ];
}

/** BYOK 本月任务含/已用/剩余（个人中心概览用）。 */
export async function getAccountByokTaskSummary(bookUserId: string, scopeKey: string) {
  const periodKey = currentPeriodKey();
  const [quotas, usage, settlementCounts] = await Promise.all([
    prisma.byokTaskQuota.findMany({
      where: { scopeKey, active: true },
      orderBy: { taskKind: "asc" },
    }),
    prisma.byokUsageMonthly.findMany({
      where: { ownerType: "USER", ownerId: bookUserId, periodKey },
    }),
    prisma.billingSettlementLine.groupBy({
      by: ["byokTaskKind"],
      where: {
        ownerType: "USER",
        ownerId: bookUserId,
        periodKey,
        settlementKind: "BYOK_QUOTA_INCLUDED",
        byokTaskKind: { not: null },
      },
      _count: { _all: true },
    }),
  ]);

  const usageByKind = new Map(usage.map((u) => [u.taskKind, u]));
  const settlementByKind = new Map(
    settlementCounts.map((s) => [s.byokTaskKind!, s._count._all]),
  );
  return Promise.all(
    quotas.map(async (q) => {
      const row = usageByKind.get(q.taskKind);
      const includedUsed = settlementByKind.get(q.taskKind) ?? row?.includedUsed ?? 0;
      if (row && row.includedUsed !== includedUsed) {
        await prisma.byokUsageMonthly
          .update({
            where: { id: row.id },
            data: { includedUsed },
          })
          .catch(() => undefined);
      }
      const monthlyIncluded = q.monthlyIncluded;
      return {
        taskKind: q.taskKind,
        label: BYOK_TASK_KIND_LABEL[q.taskKind] ?? q.label,
        monthlyIncluded,
        includedUsed,
        includedRemaining: Math.max(0, monthlyIncluded - includedUsed),
        overageUsed: row?.overageUsed ?? 0,
      };
    }),
  );
}

/** 按工具聚合 Gateway 成功调用。 */
export async function aggregateUsageByTool(bookUserId: string) {
  const logs = await prisma.gatewayRequestLog.findMany({
    where: buildGatewayLogActorWhere(bookUserId, { status: "SUCCEEDED" }),
    select: { clientPage: true, creditsCharged: true },
  });

  const map = new Map<string, { count: number; creditsCharged: number; toolLabel: string }>();
  for (const log of logs) {
    const toolKey = log.clientPage?.trim()
      ? log.clientPage.trim().replace(/\//g, "__")
      : clientPageToToolKey(log.clientPage);
    const ex = map.get(toolKey) ?? {
      count: 0,
      creditsCharged: 0,
      toolLabel: clientPageToToolLabel(log.clientPage),
    };
    ex.count += 1;
    ex.creditsCharged += log.creditsCharged ?? 0;
    map.set(toolKey, ex);
  }

  return Array.from(map.entries())
    .map(([toolKey, v]) => ({ toolKey, ...v }))
    .sort((a, b) => b.count - a.count || b.creditsCharged - a.creditsCharged);
}

export async function countSucceededUsage(bookUserId: string): Promise<number> {
  return prisma.gatewayRequestLog.count({
    where: buildGatewayLogActorWhere(bookUserId, { status: "SUCCEEDED" }),
  });
}
