/**
 * Book 管理后台 · 平台驾驶舱数据聚合（概览页 SSOT）。
 */
import { WalletEntryType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  getCreditOpsAlerts,
  getCreditOpsDashboard,
  cstBusinessDate,
} from "@/lib/billing/credit-ops-service";
import type { CreditOpsAlert } from "@/lib/billing/credit-ops-alerts";
import {
  getAssistantFeedbackSummary,
  listOpenAssistantFeedback,
  type AssistantFeedbackListItem,
} from "@/lib/platform-assistant/feedback-service";
import { listRecentAiNewsDaily } from "@/lib/platform-assistant/ai-news-service";

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

const CST_OFFSET_MS = 8 * 60 * 60 * 1000;
const CREDIT_TREND_DAYS = 14;

function cstDateKey(d: Date): string {
  const cst = new Date(d.getTime() + CST_OFFSET_MS);
  return `${cst.getUTCFullYear()}-${String(cst.getUTCMonth() + 1).padStart(2, "0")}-${String(cst.getUTCDate()).padStart(2, "0")}`;
}

function lastNCstDateKeys(n: number, now: Date): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(cstDateKey(new Date(now.getTime() - i * 24 * 60 * 60 * 1000)));
  }
  return keys;
}

export type CockpitChartDatum = { label: string; value: number };
export type CockpitTrendDatum = { date: string; value: number };

export type PlatformCockpitSnapshot = {
  generatedAt: string;
  businessDateCst: string;
  users: {
    total: number;
    platformCredit: number;
    byok: number;
    newToday: number;
  };
  courseSubscriptions: { active: number };
  credits: {
    accountCount: number;
    totalBalance: number;
    subscriptionAccounts: number;
    consumedAllTime: number;
    consumedToday: number;
  };
  teams: { activeTenants: number; activeMembers: number };
  gateway: {
    todaySucceeded: number;
    todayFailed: number;
    todayRunning: number;
    monthSucceeded: number;
  };
  generation: {
    canvasInFlight: number;
    canvasFailedToday: number;
  };
  walletLegacy: {
    totalBalancePoints: number;
    totalRechargePoints: number;
    rechargeTxCount: number;
  };
  platformHealth: {
    unresolvedErrors: number;
    errorsLast24h: number;
  };
  creditOps: Awaited<ReturnType<typeof getCreditOpsDashboard>>;
  creditOpsAlerts: CreditOpsAlert[];
  charts: {
    userIdentity: CockpitChartDatum[];
    creditsBilling: CockpitChartDatum[];
    creditConsumptionTrend: CockpitTrendDatum[];
  };
  assistantFeedback: {
    summary: Awaited<ReturnType<typeof getAssistantFeedbackSummary>>;
    items: AssistantFeedbackListItem[];
  };
  assistantAiNews: Awaited<ReturnType<typeof listRecentAiNewsDaily>>;
};

export async function getPlatformCockpitSnapshot(
  now: Date = new Date(),
): Promise<PlatformCockpitSnapshot> {
  const dayStart = startOfUtcDay(now);
  const monthStart = startOfUtcMonth(now);
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    userCount,
    platformCreditUsers,
    byokUsers,
    newUsersToday,
    activeSubscriptions,
    creditAgg,
    subscriptionAccountCount,
    creditConsumeAll,
    creditConsumeToday,
    activeTenants,
    activeMembers,
    gwTodayOk,
    gwTodayFail,
    gwTodayRun,
    gwMonthOk,
    canvasInFlight,
    canvasFailToday,
    balanceSum,
    rechargeSum,
    rechargeTxCount,
    unresolvedErrors,
    errorsLast24h,
  ] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({ where: { billingPersona: "PLATFORM_CREDIT" } }),
    prisma.user.count({ where: { billingPersona: "BYOK" } }),
    prisma.user.count({ where: { createdAt: { gte: dayStart } } }),
    prisma.subscription.count({
      where: { status: "ACTIVE", currentPeriodEnd: { gt: now } },
    }),
    prisma.creditAccount.aggregate({
      _count: { id: true },
      _sum: { balanceCredits: true },
    }),
    prisma.creditAccount.count({ where: { monthlyGrantCredits: { gt: 0 } } }),
    prisma.creditLedger.aggregate({
      where: { type: { in: ["CONSUME", "SETTLE"] } },
      _sum: { credits: true },
    }),
    prisma.creditLedger.aggregate({
      where: { type: { in: ["CONSUME", "SETTLE"] }, createdAt: { gte: dayStart } },
      _sum: { credits: true },
    }),
    prisma.tenant.count({ where: { status: "ACTIVE" } }),
    prisma.tenantMember.count({ where: { status: "ACTIVE" } }),
    prisma.gatewayRequestLog.count({
      where: { status: "SUCCEEDED", submittedAt: { gte: dayStart } },
    }),
    prisma.gatewayRequestLog.count({
      where: { status: "FAILED", submittedAt: { gte: dayStart } },
    }),
    prisma.gatewayRequestLog.count({
      where: { status: { in: ["PENDING", "RUNNING"] } },
    }),
    prisma.gatewayRequestLog.count({
      where: { status: "SUCCEEDED", submittedAt: { gte: monthStart } },
    }),
    prisma.canvasGenerationTask.count({
      where: {
        status: { in: ["QUEUED", "DISPATCHING", "PENDING", "SUBMITTED"] },
        deletedAt: null,
      },
    }),
    prisma.canvasGenerationTask.count({
      where: { status: "FAILED", updatedAt: { gte: dayStart }, deletedAt: null },
    }),
    prisma.wallet.aggregate({ _sum: { balancePoints: true } }),
    prisma.walletEntry.aggregate({
      where: { type: WalletEntryType.RECHARGE },
      _sum: { amountPoints: true },
    }),
    prisma.walletEntry.count({ where: { type: WalletEntryType.RECHARGE } }),
    prisma.platformErrorLog.count({ where: { resolvedAt: null } }),
    prisma.platformErrorLog.count({ where: { createdAt: { gte: last24h } } }),
  ]);

  const [creditOpsDashboard, alerts, creditTrendLedgers, assistantFeedbackSummary, assistantFeedbackItems, assistantAiNewsRows] =
    await Promise.all([
    getCreditOpsDashboard({ now }),
    getCreditOpsAlerts(now),
    prisma.creditLedger.findMany({
      where: {
        type: { in: ["CONSUME", "SETTLE"] },
        createdAt: {
          gte: new Date(now.getTime() - CREDIT_TREND_DAYS * 24 * 60 * 60 * 1000),
        },
      },
      select: { createdAt: true, credits: true },
    }),
    getAssistantFeedbackSummary(),
    listOpenAssistantFeedback(20),
    listRecentAiNewsDaily(3),
  ]);

  const trendKeys = lastNCstDateKeys(CREDIT_TREND_DAYS, now);
  const trendBuckets = new Map<string, number>(trendKeys.map((k) => [k, 0]));
  for (const row of creditTrendLedgers) {
    const key = cstDateKey(row.createdAt);
    if (!trendBuckets.has(key)) continue;
    trendBuckets.set(key, (trendBuckets.get(key) ?? 0) + Math.abs(row.credits));
  }

  const userTotal = userCount;
  const platformCredit = platformCreditUsers;
  const byok = byokUsers;
  const activeSubs = activeSubscriptions;
  const newToday = newUsersToday;

  return {
    generatedAt: now.toISOString(),
    businessDateCst: cstBusinessDate(now),
    users: {
      total: userCount,
      platformCredit: platformCreditUsers,
      byok: byokUsers,
      newToday: newUsersToday,
    },
    courseSubscriptions: { active: activeSubscriptions },
    credits: {
      accountCount: creditAgg._count.id,
      totalBalance: creditAgg._sum.balanceCredits ?? 0,
      subscriptionAccounts: subscriptionAccountCount,
      consumedAllTime: Math.abs(creditConsumeAll._sum.credits ?? 0),
      consumedToday: Math.abs(creditConsumeToday._sum.credits ?? 0),
    },
    teams: { activeTenants, activeMembers },
    gateway: {
      todaySucceeded: gwTodayOk,
      todayFailed: gwTodayFail,
      todayRunning: gwTodayRun,
      monthSucceeded: gwMonthOk,
    },
    generation: {
      canvasInFlight,
      canvasFailedToday: canvasFailToday,
    },
    walletLegacy: {
      totalBalancePoints: balanceSum._sum.balancePoints ?? 0,
      totalRechargePoints: rechargeSum._sum.amountPoints ?? 0,
      rechargeTxCount,
    },
    platformHealth: {
      unresolvedErrors,
      errorsLast24h,
    },
    creditOps: creditOpsDashboard,
    creditOpsAlerts: alerts,
    charts: {
      userIdentity: [
        { label: "注册用户", value: userTotal },
        { label: "平台代付", value: platformCredit },
        { label: "BYOK", value: byok },
        { label: "有效课程订阅", value: activeSubs },
        { label: "今日新增", value: newToday },
      ],
      creditsBilling: [
        {
          label: "积分池余额",
          value: creditAgg._sum.balanceCredits ?? 0,
        },
        { label: "今日消耗", value: Math.abs(creditConsumeToday._sum.credits ?? 0) },
        { label: "累计消耗", value: Math.abs(creditConsumeAll._sum.credits ?? 0) },
        { label: "钱包余额", value: balanceSum._sum.balancePoints ?? 0 },
      ],
      creditConsumptionTrend: trendKeys.map((date) => ({
        date,
        value: trendBuckets.get(date) ?? 0,
      })),
    },
    assistantFeedback: {
      summary: assistantFeedbackSummary,
      items: assistantFeedbackItems,
    },
    assistantAiNews: assistantAiNewsRows,
  };
}
