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
  return { inProgress: 0, succeeded: 0, failed: 0, cancelled: 0, slowWarn: 0 };
}

export function buildEmptyCategoryCounts(): DashboardCategoryCount[] {
  return DASHBOARD_STATUS_CHART_ORDER.map((category) => ({
    category,
    label: dashboardStatusChartCategoryLabel(category),
    count: 0,
  }));
}

function resolveChartLogModelKey(row: DashboardChartLogRow): string {
  const canonical = row.canonicalModelKey?.trim();
  if (canonical) return canonical;
  const model = row.model?.trim();
  return model || "unknown";
}

function aggregateChartCategories(
  rows: DashboardChartLogRow[],
): DashboardStatsPayload["byCategory"] {
  const inProgress = buildEmptyCategoryCounts();
  const succeeded = buildEmptyCategoryCounts();

  for (const row of rows) {
    const bucket = dashboardStatusBucket(row.status);
    if (bucket !== "inProgress" && bucket !== "succeeded") continue;
    const cat = resolveDashboardChartCategory(row, row.billingCategory);
    const target = bucket === "inProgress" ? inProgress : succeeded;
    bumpCategoryCount(target, cat, 1);
  }

  return { inProgress, succeeded };
}

function aggregateChartModels(
  rows: DashboardChartLogRow[],
): DashboardStatsPayload["byModel"] {
  const inProgress = new Map<string, DashboardModelCount>();
  const succeeded = new Map<string, DashboardModelCount>();

  for (const row of rows) {
    const bucket = dashboardStatusBucket(row.status);
    if (bucket !== "inProgress" && bucket !== "succeeded") continue;
    const modelKey = resolveChartLogModelKey(row);
    const target = bucket === "inProgress" ? inProgress : succeeded;
    const existing = target.get(modelKey);
    if (existing) {
      existing.count += 1;
      continue;
    }
    target.set(modelKey, {
      model: row.model?.trim() || modelKey,
      canonicalModelKey: row.canonicalModelKey?.trim() || null,
      count: 1,
    });
  }

  return {
    inProgress: sortModelCounts(inProgress),
    succeeded: sortModelCounts(succeeded),
  };
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

async function fetchDashboardChartRows(
  where: Prisma.GatewayRequestLogWhereInput,
): Promise<DashboardChartLogRow[]> {
  const chartStatuses: GatewayRequestStatus[] = [
    ...DASHBOARD_IN_PROGRESS_STATUSES,
    "SUCCEEDED",
  ];
  return prisma.gatewayRequestLog.findMany({
    where: {
      AND: [where, { status: { in: chartStatuses } }],
    },
    select: CHART_LOG_SELECT,
  });
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
  const slowWarn = await prisma.gatewayRequestLog.count({
    where: {
      AND: [where, buildSlowGenerationWhere(slowWarnMs)],
    },
  });
  return {
    cards: {
      ...mergeStatusGroupCounts(
        statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
      ),
      slowWarn,
    },
  };
}

export async function fetchDashboardCategoryStats(
  where: Prisma.GatewayRequestLogWhereInput,
): Promise<{ byCategory: DashboardStatsPayload["byCategory"] }> {
  const chartRows = await fetchDashboardChartRows(where);
  return { byCategory: aggregateChartCategories(chartRows) };
}

export async function fetchDashboardModelStats(
  where: Prisma.GatewayRequestLogWhereInput,
): Promise<{ byModel: DashboardStatsPayload["byModel"] }> {
  const chartRows = await fetchDashboardChartRows(where);
  return { byModel: aggregateChartModels(chartRows) };
}

export async function fetchDashboardChartStats(
  where: Prisma.GatewayRequestLogWhereInput,
): Promise<Pick<DashboardStatsPayload, "byCategory" | "byModel">> {
  const chartRows = await fetchDashboardChartRows(where);
  return {
    byCategory: aggregateChartCategories(chartRows),
    byModel: aggregateChartModels(chartRows),
  };
}

export type DashboardStatsParts = "summary" | "categories" | "models";

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
    if (t === "summary" || t === "categories" || t === "models") parts.add(t);
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
