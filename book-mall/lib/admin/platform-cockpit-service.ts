/**
 * Book 管理后台 · 平台驾驶舱数据聚合（概览页 SSOT）。
 */
import { WalletEntryType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  getCreditOpsAlerts,
  getCreditOpsDashboard,
  cstBusinessDate,
  cstDayStartUtc,
} from "@/lib/billing/credit-ops-service";
import {
  buildCockpitCommerceMonthKpis,
  type CockpitCommerceMonthKpis,
} from "@/lib/admin/platform-cockpit-commerce-kpis";
import {
  buildCockpitModelUsageSnapshot,
  type CockpitModelUsageSnapshot,
  type CockpitModelUsageTrendDatum,
} from "@/lib/admin/platform-cockpit-model-usage";
import { currentPeriodKey, periodBounds } from "@/lib/finance/team-finance-guard";
import type { CreditOpsAlert } from "@/lib/billing/credit-ops-alerts";
import {
  getAssistantFeedbackSummary,
  listOpenAssistantFeedback,
  type AssistantFeedbackListItem,
} from "@/lib/platform-assistant/feedback-service";
import { listRecentAiNewsDaily } from "@/lib/platform-assistant/ai-news-service";
import {
  getPlatformAssistantModelConfigView,
  listAssistantEmbedCandidates,
  listAssistantLlmCandidates,
} from "@/lib/platform-assistant/platform-assistant-model-config-service";
import { getTodayTrafficTotals } from "@/lib/site-traffic/queries";
import {
  buildCockpitFinanceKpis,
  type CockpitFinanceKpis,
} from "@/lib/admin/platform-cockpit-finance-kpis";

function cstDayBounds(now: Date): { start: Date; end: Date } {
  const businessDate = cstBusinessDate(now);
  const start = cstDayStartUtc(businessDate);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
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

export type { CockpitModelUsageTrendDatum };
export type { CockpitCommerceMonthKpis };

export type PlatformCockpitFinanceSection = {
  finance: CockpitFinanceKpis;
};

export type PlatformCockpitSnapshot = {
  generatedAt: string;
  businessDateCst: string;
  users: {
    total: number;
    platformCredit: number;
    byok: number;
    newToday: number;
    newTodayPlatformCredit: number;
  };
  commerce: CockpitCommerceMonthKpis;
  modelUsage: CockpitModelUsageSnapshot;
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
    modelUsageTrend: CockpitModelUsageTrendDatum[];
  };
  assistantFeedback: {
    summary: Awaited<ReturnType<typeof getAssistantFeedbackSummary>>;
    items: AssistantFeedbackListItem[];
  };
  assistantAiNews: Awaited<ReturnType<typeof listRecentAiNewsDaily>>;
  assistantModelConfig: {
    config: Awaited<ReturnType<typeof getPlatformAssistantModelConfigView>>;
    llmCandidates: ReturnType<typeof listAssistantLlmCandidates>;
    embedCandidates: ReturnType<typeof listAssistantEmbedCandidates>;
  };
  traffic: {
    todayPageViews: number;
    todayProbeViews: number;
    todayUniqueIps: number;
  };
};

export type PlatformCockpitCreditOpsSection = Pick<
  PlatformCockpitSnapshot,
  "creditOps" | "creditOpsAlerts"
>;

export type PlatformCockpitAssistantSection = Pick<
  PlatformCockpitSnapshot,
  "assistantFeedback" | "assistantAiNews" | "assistantModelConfig"
>;

export type PlatformCockpitMetricsSection = Pick<
  PlatformCockpitSnapshot,
  | "generatedAt"
  | "businessDateCst"
  | "users"
  | "commerce"
  | "modelUsage"
  | "courseSubscriptions"
  | "credits"
  | "teams"
  | "gateway"
  | "generation"
  | "walletLegacy"
  | "platformHealth"
  | "charts"
  | "traffic"
>;

async function fetchCockpitCountMetrics(now: Date) {
  const { start: dayStart, end: dayEnd } = cstDayBounds(now);
  const periodKey = currentPeriodKey(now);
  const { from: monthStart, to: monthEnd } = periodBounds(periodKey);
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const todayCreatedAt = { gte: dayStart, lt: dayEnd };

  // 并行 count/aggregate，避免 $transaction 长时间占连接（PgBouncer 下更易 P2028）。
  return Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { billingPersona: "PLATFORM_CREDIT" } }),
    prisma.user.count({ where: { billingPersona: "BYOK" } }),
    prisma.user.count({ where: { createdAt: todayCreatedAt } }),
    prisma.user.count({
      where: { createdAt: todayCreatedAt, billingPersona: "PLATFORM_CREDIT" },
    }),
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
      where: { type: { in: ["CONSUME", "SETTLE"] }, createdAt: todayCreatedAt },
      _sum: { credits: true },
    }),
    prisma.tenant.count({ where: { status: "ACTIVE" } }),
    prisma.tenantMember.count({ where: { status: "ACTIVE" } }),
    prisma.gatewayRequestLog.count({
      where: { status: "SUCCEEDED", submittedAt: todayCreatedAt },
    }),
    prisma.gatewayRequestLog.count({
      where: { status: "FAILED", submittedAt: todayCreatedAt },
    }),
    prisma.gatewayRequestLog.count({
      where: { status: { in: ["PENDING", "RUNNING"] } },
    }),
    prisma.gatewayRequestLog.count({
      where: { status: "SUCCEEDED", submittedAt: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.canvasGenerationTask.count({
      where: {
        status: { in: ["QUEUED", "DISPATCHING", "PENDING", "SUBMITTED"] },
        deletedAt: null,
      },
    }),
    prisma.canvasGenerationTask.count({
      where: { status: "FAILED", updatedAt: todayCreatedAt, deletedAt: null },
    }),
    prisma.wallet.aggregate({ _sum: { balancePoints: true } }),
    prisma.walletEntry.aggregate({
      where: { type: WalletEntryType.RECHARGE },
      _sum: { amountPoints: true },
    }),
    prisma.walletEntry.count({ where: { type: WalletEntryType.RECHARGE } }),
    prisma.platformErrorLog.count({ where: { resolvedAt: null } }),
    prisma.platformErrorLog.count({ where: { createdAt: { gte: last24h } } }),
  ] as const);
}

function buildMetricsSectionFromCounts(
  now: Date,
  counts: Awaited<ReturnType<typeof fetchCockpitCountMetrics>>,
  creditTrendLedgers: Array<{ createdAt: Date; credits: number }>,
  trafficToday: { pageViews: number; probeViews: number; uniqueIps: number },
  commerce: CockpitCommerceMonthKpis,
  modelUsage: CockpitModelUsageSnapshot,
): PlatformCockpitMetricsSection {
  const [
    userCount,
    platformCreditUsers,
    byokUsers,
    newUsersToday,
    newUsersTodayPlatformCredit,
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
  ] = counts;

  const trendKeys = lastNCstDateKeys(CREDIT_TREND_DAYS, now);
  const trendBuckets = new Map<string, number>(trendKeys.map((k) => [k, 0]));
  for (const row of creditTrendLedgers) {
    const key = cstDateKey(row.createdAt);
    if (!trendBuckets.has(key)) continue;
    trendBuckets.set(key, (trendBuckets.get(key) ?? 0) + Math.abs(row.credits));
  }

  return {
    generatedAt: now.toISOString(),
    businessDateCst: cstBusinessDate(now),
    users: {
      total: userCount,
      platformCredit: platformCreditUsers,
      byok: byokUsers,
      newToday: newUsersToday,
      newTodayPlatformCredit: newUsersTodayPlatformCredit,
    },
    commerce,
    modelUsage,
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
    charts: {
      userIdentity: [
        { label: "注册用户", value: userCount },
        { label: "平台代付", value: platformCreditUsers },
        { label: "BYOK", value: byokUsers },
        { label: "有效课程订阅", value: activeSubscriptions },
        { label: "今日新增", value: newUsersToday },
      ],
      creditsBilling: [
        { label: "积分池余额", value: creditAgg._sum.balanceCredits ?? 0 },
        { label: "今日消耗", value: Math.abs(creditConsumeToday._sum.credits ?? 0) },
        { label: "累计消耗", value: Math.abs(creditConsumeAll._sum.credits ?? 0) },
        { label: "钱包余额", value: balanceSum._sum.balancePoints ?? 0 },
      ],
      creditConsumptionTrend: trendKeys.map((date) => ({
        date,
        value: trendBuckets.get(date) ?? 0,
      })),
      modelUsageTrend: modelUsage.trend,
    },
    traffic: {
      todayPageViews: trafficToday.pageViews,
      todayProbeViews: trafficToday.probeViews,
      todayUniqueIps: trafficToday.uniqueIps,
    },
  };
}

/** 本月经营三角：应付厂商 / 用户实收 / 毛利 */
export async function fetchPlatformCockpitFinanceSection(input?: {
  periodKey?: string;
  now?: Date;
}): Promise<PlatformCockpitFinanceSection> {
  const finance = await buildCockpitFinanceKpis(input);
  return { finance };
}

/** 积分清零运维（驾驶舱首屏优先块） */
export async function fetchPlatformCockpitCreditOpsSection(
  now: Date = new Date(),
): Promise<PlatformCockpitCreditOpsSection> {
  const [creditOps, creditOpsAlerts] = await Promise.all([
    getCreditOpsDashboard({ now }),
    getCreditOpsAlerts(now),
  ]);
  return { creditOps, creditOpsAlerts };
}

/** 小智反馈 + AI 热闻 + 模型配置 */
export async function fetchPlatformCockpitAssistantSection(): Promise<PlatformCockpitAssistantSection> {
  const [summary, items, assistantAiNews, config] = await Promise.all([
    getAssistantFeedbackSummary(),
    listOpenAssistantFeedback(20),
    listRecentAiNewsDaily(3),
    getPlatformAssistantModelConfigView(),
  ]);
  return {
    assistantFeedback: { summary, items },
    assistantAiNews,
    assistantModelConfig: {
      config,
      llmCandidates: listAssistantLlmCandidates(),
      embedCandidates: listAssistantEmbedCandidates(),
    },
  };
}

/** KPI、图表、Gateway、访问统计 */
export async function fetchPlatformCockpitMetricsSection(
  now: Date = new Date(),
): Promise<PlatformCockpitMetricsSection> {
  const trendSince = new Date(now.getTime() - CREDIT_TREND_DAYS * 24 * 60 * 60 * 1000);
  const [counts, creditTrendLedgers, trafficToday, commerce, modelUsage] = await Promise.all([
    fetchCockpitCountMetrics(now),
    prisma.creditLedger.findMany({
      where: {
        type: { in: ["CONSUME", "SETTLE"] },
        createdAt: { gte: trendSince },
      },
      select: { createdAt: true, credits: true },
    }),
    getTodayTrafficTotals(now),
    buildCockpitCommerceMonthKpis({ now }),
    buildCockpitModelUsageSnapshot({ now }),
  ]);
  return buildMetricsSectionFromCounts(
    now,
    counts,
    creditTrendLedgers,
    trafficToday,
    commerce,
    modelUsage,
  );
}

export async function getPlatformCockpitSnapshot(
  now: Date = new Date(),
): Promise<PlatformCockpitSnapshot> {
  const [creditOpsSection, assistantSection, metricsSection] = await Promise.all([
    fetchPlatformCockpitCreditOpsSection(now),
    fetchPlatformCockpitAssistantSection(),
    fetchPlatformCockpitMetricsSection(now),
  ]);

  return {
    ...metricsSection,
    ...creditOpsSection,
    ...assistantSection,
  };
}
