import { prisma } from "@/lib/prisma";
import { BYOK_TASK_KIND_LABEL } from "@/lib/billing/byok-pricing";
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

/** 个人中心概览：本月积分发放/消耗/剩余 + BYOK 任务额度。 */
export async function getAccountUsageSummary(bookUserId: string) {
  const ref = { ownerType: "USER" as const, ownerId: bookUserId };
  const since = monthStartUtc();

  const account = await prisma.creditAccount.findUnique({
    where: { ownerType_ownerId: ref },
    select: { id: true },
  });

  const [pools, grantedAgg, consumedAgg, totalCalls, succeededAll] = await Promise.all([
    getPoolBalances(ref),
    account
      ? prisma.creditLedger.aggregate({
          where: {
            accountId: account.id,
            createdAt: { gte: since },
            type: { in: ["GRANT", "TOPUP", "ADJUST"] },
          },
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
      where: { actorBookUserId: bookUserId, status: "SUCCEEDED", submittedAt: { gte: since } },
    }),
    prisma.gatewayRequestLog.count({
      where: { actorBookUserId: bookUserId, status: "SUCCEEDED" },
    }),
  ]);

  const creditsGranted = Math.max(0, grantedAgg._sum.credits ?? 0);
  const creditsConsumed = Math.abs(consumedAgg._sum.credits ?? 0);
  const creditsRemaining = pools.general.balance + pools.video.balance;

  return {
    periodStart: since.toISOString(),
    creditsGranted,
    creditsConsumed,
    creditsRemaining,
    generalBalance: pools.general.balance,
    videoBalance: pools.video.balance,
    totalCallsThisMonth: totalCalls,
    totalCallsAll: succeededAll,
  };
}

/** BYOK 本月任务含/已用/剩余（个人中心概览用）。 */
export async function getAccountByokTaskSummary(bookUserId: string, scopeKey: string) {
  const periodKey = currentPeriodKey();
  const [quotas, usage] = await Promise.all([
    prisma.byokTaskQuota.findMany({
      where: { scopeKey, active: true },
      orderBy: { taskKind: "asc" },
    }),
    prisma.byokUsageMonthly.findMany({
      where: { ownerType: "USER", ownerId: bookUserId, periodKey },
    }),
  ]);

  const usageByKind = new Map(usage.map((u) => [u.taskKind, u]));
  return quotas.map((q) => {
    const row = usageByKind.get(q.taskKind);
    const includedUsed = row?.includedUsed ?? 0;
    const monthlyIncluded = q.monthlyIncluded;
    return {
      taskKind: q.taskKind,
      label: BYOK_TASK_KIND_LABEL[q.taskKind] ?? q.label,
      monthlyIncluded,
      includedUsed,
      includedRemaining: Math.max(0, monthlyIncluded - includedUsed),
      overageUsed: row?.overageUsed ?? 0,
    };
  });
}

/** 按工具聚合 Gateway 成功调用。 */
export async function aggregateUsageByTool(bookUserId: string) {
  const logs = await prisma.gatewayRequestLog.findMany({
    where: { actorBookUserId: bookUserId, status: "SUCCEEDED" },
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
    where: { actorBookUserId: bookUserId, status: "SUCCEEDED" },
  });
}
