import { prisma } from "@/lib/prisma";
import { BYOK_TASK_KIND_LABEL, mapLogToByokTaskKind } from "@/lib/billing/byok-pricing";
import { getPoolBalances } from "@/lib/billing/credit-account-service";
import {
  clientPageToToolKey,
  clientPageToToolLabel,
} from "@/lib/finance/client-page-tool";
import type { ByokTaskKind } from "@prisma/client";

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
  succeeded: number;
  failed: number;
  remaining: number | null;
};

type UsageCategoryKey = ByokTaskKind | "TEXT" | "TRYON";

const PACKAGE_USAGE_ROWS: { key: UsageCategoryKey; label: string }[] = [
  { key: "TEXT_TO_IMAGE", label: "文生图" },
  { key: "IMAGE_TO_VIDEO", label: "图生视频" },
  { key: "VIDEO_TO_VIDEO", label: "视频生视频" },
  { key: "TEXT", label: "文字" },
  { key: "TRYON", label: "AI试衣" },
];

function classifyGatewayUsageCategory(log: {
  requestKind: string;
  inputSummary?: unknown;
}): UsageCategoryKey | null {
  if (log.requestKind === "TRYON") return "TRYON";
  if (log.requestKind === "CHAT" || log.requestKind === "TTS") return "TEXT";
  const byok = mapLogToByokTaskKind(log);
  if (byok) return byok;
  if (log.requestKind === "IMAGE") return "TEXT_TO_IMAGE";
  return null;
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
      where: { actorBookUserId: bookUserId, status: "SUCCEEDED", submittedAt: { gte: since } },
    }),
  ]);

  const topupRaw = Math.max(0, topupAgg._sum.credits ?? 0);
  let grantCreditsThisMonth = Math.max(0, grantAgg._sum.credits ?? 0);
  const adjustCreditsThisMonth = Math.max(0, adjustAgg._sum.credits ?? 0);
  const creditsConsumed = Math.abs(consumedAgg._sum.credits ?? 0);
  const creditsRemaining = pools.general.balance + pools.video.balance;

  // BYOK 且无平台 plan：不展示历史 GRANT（切换身份前的月发流水）
  if (user?.billingPersona === "BYOK" && !account?.planId) {
    grantCreditsThisMonth = 0;
  }

  // 轻量包加购：仅统计仍有效的部分（已 EXPIRE 清零的不计入）
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

  const [logs, quotas, usage] = await Promise.all([
    prisma.gatewayRequestLog.findMany({
      where: {
        actorBookUserId: bookUserId,
        submittedAt: { gte: since },
        status: { in: ["SUCCEEDED", "FAILED"] },
      },
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
  ]);

  const quotaByKind = new Map(quotas.map((q) => [q.taskKind, q]));
  const usageByKind = new Map(usage.map((u) => [u.taskKind, u]));

  const counts = new Map<UsageCategoryKey, { succeeded: number; failed: number }>();
  for (const key of PACKAGE_USAGE_ROWS.map((r) => r.key)) {
    counts.set(key, { succeeded: 0, failed: 0 });
  }

  for (const log of logs) {
    const cat = classifyGatewayUsageCategory(log);
    if (!cat) continue;
    const row = counts.get(cat)!;
    if (log.status === "SUCCEEDED") row.succeeded += 1;
    else row.failed += 1;
  }

  return PACKAGE_USAGE_ROWS.map(({ key, label }) => {
    const c = counts.get(key)!;
    if (key === "TEXT" || key === "TRYON") {
      return {
        key,
        label,
        total: null,
        succeeded: c.succeeded,
        failed: c.failed,
        remaining: null,
      };
    }
    const quota = quotaByKind.get(key);
    const used = usageByKind.get(key)?.includedUsed ?? 0;
    const total = quota?.monthlyIncluded ?? null;
    return {
      key,
      label,
      total,
      succeeded: c.succeeded,
      failed: c.failed,
      remaining: total != null ? Math.max(0, total - used) : null,
    };
  });
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
