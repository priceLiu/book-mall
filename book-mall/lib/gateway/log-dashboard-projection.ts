/**
 * 状态驾驶舱 · GatewayRequestLog 聚合投影（与 Gateway 日志页共用枚举/类别）。
 */
import type { BillingCategory, GatewayRequestStatus, Prisma } from "@prisma/client";

import {
  BILLING_CATEGORY_CHART_ORDER,
  billingCategoryLabel,
  resolveDashboardChartCategory,
} from "@/lib/billing/billing-category";
import { prisma } from "@/lib/prisma";

export const DASHBOARD_IN_PROGRESS_STATUSES: GatewayRequestStatus[] = [
  "PENDING",
  "RUNNING",
];

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
  category: BillingCategory;
  label: string;
  count: number;
};

export type DashboardCards = {
  inProgress: number;
  succeeded: number;
  failed: number;
  cancelled: number;
};

export type DashboardStatsPayload = {
  cards: DashboardCards;
  byCategory: {
    inProgress: DashboardCategoryCount[];
    succeeded: DashboardCategoryCount[];
  };
};

export function emptyDashboardCards(): DashboardCards {
  return { inProgress: 0, succeeded: 0, failed: 0, cancelled: 0 };
}

export function buildEmptyCategoryCounts(): DashboardCategoryCount[] {
  return BILLING_CATEGORY_CHART_ORDER.map((category) => ({
    category,
    label: billingCategoryLabel(category),
    count: 0,
  }));
}

function aggregateChartCategories(
  rows: {
    status: GatewayRequestStatus;
    requestKind: string;
    inputSummary: unknown;
    billingCategory: BillingCategory | null;
  }[],
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
  category: BillingCategory,
  delta: number,
) {
  const row = rows.find((r) => r.category === category);
  if (row) row.count += delta;
}

export async function fetchDashboardStatsSummary(
  where: Prisma.GatewayRequestLogWhereInput,
): Promise<{ cards: DashboardCards }> {
  const statusGroups = await prisma.gatewayRequestLog.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });
  return {
    cards: mergeStatusGroupCounts(
      statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
    ),
  };
}

export async function fetchDashboardCategoryStats(
  where: Prisma.GatewayRequestLogWhereInput,
): Promise<{ byCategory: DashboardStatsPayload["byCategory"] }> {
  const chartStatuses: GatewayRequestStatus[] = [
    ...DASHBOARD_IN_PROGRESS_STATUSES,
    "SUCCEEDED",
  ];
  const chartRows = await prisma.gatewayRequestLog.findMany({
    where: {
      AND: [where, { status: { in: chartStatuses } }],
    },
    select: {
      status: true,
      requestKind: true,
      inputSummary: true,
      billingCategory: true,
    },
  });
  return { byCategory: aggregateChartCategories(chartRows) };
}

export type DashboardStatsParts = "summary" | "categories";

export function parseDashboardStatsParts(
  raw: string | null | undefined,
): Set<DashboardStatsParts> {
  const v = raw?.trim().toLowerCase();
  if (!v || v === "all") {
    return new Set(["summary", "categories"]);
  }
  const parts = new Set<DashboardStatsParts>();
  for (const token of v.split(",")) {
    const t = token.trim();
    if (t === "summary" || t === "categories") parts.add(t);
  }
  if (parts.size === 0) return new Set(["summary", "categories"]);
  return parts;
}

export async function fetchDashboardStats(
  where: Prisma.GatewayRequestLogWhereInput,
): Promise<DashboardStatsPayload> {
  const [summary, categories] = await Promise.all([
    fetchDashboardStatsSummary(where),
    fetchDashboardCategoryStats(where),
  ]);
  return { cards: summary.cards, byCategory: categories.byCategory };
}
