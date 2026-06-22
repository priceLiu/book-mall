/**
 * 状态驾驶舱 · GatewayRequestLog 聚合投影（与 Gateway 日志页共用枚举/类别）。
 */
import type { BillingCategory, GatewayRequestStatus, Prisma } from "@prisma/client";

import {
  dashboardStatusChartCategoryLabel,
  DASHBOARD_STATUS_CHART_ORDER,
  type DashboardChartCategoryKey,
  resolveDashboardChartCategory,
} from "@/lib/billing/billing-category";
import { buildSlowGenerationWhere } from "@/lib/generation/slow-generation";
import { resolveGenerationSlowWarnMs } from "@/lib/generation/slow-warn-config";
import { buildVideoBackgroundWaitWhere } from "@/lib/gateway/video-task-wait-policy";
import { prisma } from "@/lib/prisma";

export const DASHBOARD_IN_PROGRESS_STATUSES: GatewayRequestStatus[] = [
  "PENDING",
  "RUNNING",
];

export const DASHBOARD_MODEL_BREAKDOWN_LIMIT = 20;

export type DashboardStatusBucket =
  | "inProgress"
  | "succeeded"
  | "failed"
  | "cancelled";

export function dashboardStatusBucket(
  status: GatewayRequestStatus,
): DashboardStatusBucket {
  if (status === "SUCCEEDED") return "succeeded";
  if (status === "FAILED") return "failed";
  if (status === "CANCELLED") return "cancelled";
  return "inProgress";
}

export type DashboardCategoryCount = {
  category: DashboardChartCategoryKey;
  label: string;
  count: number;
};

export type DashboardModelCount = {
  model: string;
  canonicalModelKey: string | null;
  count: number;
};

export type DashboardCards = {
  inProgress: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  /** 耗时 ≥800s（含进行中已超阈值） */
  slowWarn: number;
  /** 进行中且已等待 ≥10min（后台化 UI 阈值） */
  backgroundWait: number;
};

export type DashboardStatsPayload = {
  cards: DashboardCards;
  byCategory: {
    inProgress: DashboardCategoryCount[];
    succeeded: DashboardCategoryCount[];
  };
  byModel: {
    inProgress: DashboardModelCount[];
    succeeded: DashboardModelCount[];
  };
};

export type DashboardChartLogRow = {
  status: GatewayRequestStatus;
  requestKind: string;
  inputSummary: unknown;
  billingCategory: BillingCategory | null;
  model: string | null;
  canonicalModelKey: string | null;
};

export function emptyDashboardCards(): DashboardCards {
  return {
    inProgress: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
    slowWarn: 0,
    backgroundWait: 0,
  };
}

export function buildEmptyCategoryCounts(): DashboardCategoryCount[] {
  return DASHBOARD_STATUS_CHART_ORDER.map((category) => ({
    category,
    label: dashboardStatusChartCategoryLabel(category),
    count: 0,
  }));
}

function resolveModelKeyFromParts(
  canonicalModelKey: string | null,
  model: string | null,
): string {
  const canonical = canonicalModelKey?.trim();
  if (canonical) return canonical;
  return model?.trim() || "unknown";
}

function sortModelCounts(map: Map<string, DashboardModelCount>): DashboardModelCount[] {
  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.model.localeCompare(b.model))
    .slice(0, DASHBOARD_MODEL_BREAKDOWN_LIMIT);
}

export function mergeStatusGroupCounts(
  groups: { status: GatewayRequestStatus; count: number }[],
): DashboardCards {
  const cards = emptyDashboardCards();
  for (const g of groups) {
    cards[dashboardStatusBucket(g.status)] += g.count;
  }
  return cards;
}

function bumpCategoryCount(
  rows: DashboardCategoryCount[],
  category: DashboardChartCategoryKey,
  delta: number,
) {
  const row = rows.find((r) => r.category === category);
  if (row) row.count += delta;
}

const CHART_LOG_SELECT = {
  status: true,
  requestKind: true,
  inputSummary: true,
  billingCategory: true,
  model: true,
  canonicalModelKey: true,
} satisfies Prisma.GatewayRequestLogSelect;

const CHART_STATUSES: GatewayRequestStatus[] = [
  ...DASHBOARD_IN_PROGRESS_STATUSES,
  "SUCCEEDED",
];

/**
 * 模型分布：纯列聚合，交给 DB groupBy（不再把窗口内所有行拉到 Node）。
 */
async function fetchChartModelStats(
  where: Prisma.GatewayRequestLogWhereInput,
): Promise<DashboardStatsPayload["byModel"]> {
  const groups = await prisma.gatewayRequestLog.groupBy({
    by: ["status", "canonicalModelKey", "model"],
    where: { AND: [where, { status: { in: CHART_STATUSES } }] },
    _count: { _all: true },
  });
  const inProgress = new Map<string, DashboardModelCount>();
  const succeeded = new Map<string, DashboardModelCount>();
  for (const g of groups) {
    const bucket = dashboardStatusBucket(g.status);
    if (bucket !== "inProgress" && bucket !== "succeeded") continue;
    const target = bucket === "inProgress" ? inProgress : succeeded;
    const modelKey = resolveModelKeyFromParts(g.canonicalModelKey, g.model);
    const count = g._count._all;
    const existing = target.get(modelKey);
    if (existing) {
      existing.count += count;
      continue;
    }
    target.set(modelKey, {
      model: g.model?.trim() || modelKey,
      canonicalModelKey: g.canonicalModelKey?.trim() || null,
      count,
    });
  }
  return {
    inProgress: sortModelCounts(inProgress),
    succeeded: sortModelCounts(succeeded),
  };
}

/**
 * 类别分布：已落库的具体大类（billingCategory != OTHER/null）直接 DB groupBy 计数；
 * 仅 OTHER / NULL 子集才需要拉行按 requestKind/model/inputSummary 运行时归类
 * （该子集通常远小于全量，避免对大表无上限全扫）。结果与逐行聚合一致。
 */
async function fetchChartCategoryStats(
  where: Prisma.GatewayRequestLogWhereInput,
): Promise<DashboardStatsPayload["byCategory"]> {
  const inProgress = buildEmptyCategoryCounts();
  const succeeded = buildEmptyCategoryCounts();
  const chartWhere: Prisma.GatewayRequestLogWhereInput = {
    AND: [where, { status: { in: CHART_STATUSES } }],
  };

  const [groups, otherRows] = await Promise.all([
    prisma.gatewayRequestLog.groupBy({
      by: ["status", "billingCategory"],
      where: chartWhere,
      _count: { _all: true },
    }),
    prisma.gatewayRequestLog.findMany({
      where: {
        AND: [chartWhere, { OR: [{ billingCategory: null }, { billingCategory: "OTHER" }] }],
      },
      select: CHART_LOG_SELECT,
    }),
  ]);

  for (const g of groups) {
    if (!g.billingCategory || g.billingCategory === "OTHER") continue;
    const bucket = dashboardStatusBucket(g.status);
    const target =
      bucket === "inProgress" ? inProgress : bucket === "succeeded" ? succeeded : null;
    if (!target) continue;
    bumpCategoryCount(
      target,
      g.billingCategory as DashboardChartCategoryKey,
      g._count._all,
    );
  }

  for (const row of otherRows) {
    const bucket = dashboardStatusBucket(row.status);
    if (bucket !== "inProgress" && bucket !== "succeeded") continue;
    const cat = resolveDashboardChartCategory(row, row.billingCategory);
    bumpCategoryCount(bucket === "inProgress" ? inProgress : succeeded, cat, 1);
  }

  return { inProgress, succeeded };
}

export async function fetchDashboardStatsSummary(
  where: Prisma.GatewayRequestLogWhereInput,
): Promise<{ cards: DashboardCards }> {
  const [statusGroups, slowWarnMs] = await Promise.all([
    prisma.gatewayRequestLog.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
    resolveGenerationSlowWarnMs(),
  ]);
  const [slowWarn, backgroundWait] = await Promise.all([
    prisma.gatewayRequestLog.count({
      where: {
        AND: [where, buildSlowGenerationWhere(slowWarnMs)],
      },
    }),
    prisma.gatewayRequestLog.count({
      where: {
        AND: [where, buildVideoBackgroundWaitWhere()],
      },
    }),
  ]);
  return {
    cards: {
      ...mergeStatusGroupCounts(
        statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
      ),
      slowWarn,
      backgroundWait,
    },
  };
}

export type DashboardFailCodeCount = {
  failCode: string;
  count: number;
};

/** 失败日志 · 按 failCode 分组（状态页失败 Tab 分栏） */
export async function fetchDashboardFailCodeCounts(
  where: Prisma.GatewayRequestLogWhereInput,
): Promise<{ failCodes: DashboardFailCodeCount[]; failedTotal: number }> {
  const failedWhere: Prisma.GatewayRequestLogWhereInput = {
    AND: [where, { status: "FAILED" }],
  };
  const [groups, failedTotal] = await Promise.all([
    prisma.gatewayRequestLog.groupBy({
      by: ["failCode"],
      where: failedWhere,
      _count: { _all: true },
    }),
    prisma.gatewayRequestLog.count({ where: failedWhere }),
  ]);
  const failCodes = groups
    .map((g) => ({
      failCode: g.failCode?.trim() || "UNKNOWN",
      count: g._count._all,
    }))
    .sort((a, b) => b.count - a.count);
  return { failCodes, failedTotal };
}

export async function fetchDashboardCategoryStats(
  where: Prisma.GatewayRequestLogWhereInput,
): Promise<{ byCategory: DashboardStatsPayload["byCategory"] }> {
  return { byCategory: await fetchChartCategoryStats(where) };
}

export async function fetchDashboardModelStats(
  where: Prisma.GatewayRequestLogWhereInput,
): Promise<{ byModel: DashboardStatsPayload["byModel"] }> {
  return { byModel: await fetchChartModelStats(where) };
}

export async function fetchDashboardChartStats(
  where: Prisma.GatewayRequestLogWhereInput,
): Promise<Pick<DashboardStatsPayload, "byCategory" | "byModel">> {
  const [byCategory, byModel] = await Promise.all([
    fetchChartCategoryStats(where),
    fetchChartModelStats(where),
  ]);
  return { byCategory, byModel };
}

export type DashboardStatsParts = "summary" | "categories" | "models" | "failCodes";

export function parseDashboardStatsParts(
  raw: string | null | undefined,
): Set<DashboardStatsParts> {
  const v = raw?.trim().toLowerCase();
  if (!v || v === "all") {
    return new Set(["summary", "categories", "models"]);
  }
  const parts = new Set<DashboardStatsParts>();
  for (const token of v.split(",")) {
    const t = token.trim();
    if (
      t === "summary" ||
      t === "categories" ||
      t === "models" ||
      t === "failCodes"
    ) {
      parts.add(t);
    }
  }
  if (parts.size === 0) return new Set(["summary", "categories", "models"]);
  return parts;
}

export async function fetchDashboardStats(
  where: Prisma.GatewayRequestLogWhereInput,
): Promise<DashboardStatsPayload> {
  const [summary, charts] = await Promise.all([
    fetchDashboardStatsSummary(where),
    fetchDashboardChartStats(where),
  ]);
  return {
    cards: summary.cards,
    byCategory: charts.byCategory,
    byModel: charts.byModel,
  };
}
