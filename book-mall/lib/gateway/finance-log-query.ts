/**
 * 财务 / Gateway 用量聚合 — 查询归口（与 log-query-scope 配合）。
 *
 * - 账期：`periodBounds(periodKey)` → submittedAt ∈ [from, to)（to 不含）
 * - 团队 scope：`buildTeamGatewayUsageWhere` / `buildGatewayLogWhereForTeamTenant`
 * - 团队成功日志取数：`fetchTeamGatewayUsageLogs`（财务聚合 / 与驾驶舱 team scope 同源）
 * - 个人 actor 用量：`buildGatewayLogActorOnlyScope`
 * - 七类张/秒/千Token：`gateway-token-usage-aggregate`（仅 SUCCEEDED）
 *
 * 状态驾驶舱 / Gateway 日志列表：按 Tab 展示调用次数（可与下方用量单位不同，见 billing-category-taxonomy）。
 */
import type { GatewayRequestStatus, Prisma } from "@prisma/client";

import { periodBounds } from "@/lib/finance/team-finance-guard";

/** 财务七类用量汇总（团队列表 / 个人列表 / 明细头）仅统计成功调用 */
export const FINANCE_USAGE_AGGREGATE_STATUS: GatewayRequestStatus = "SUCCEEDED";

/** 费用明细「全部用量」Tab */
export const BILLING_DETAILS_USAGE_STATUSES: GatewayRequestStatus[] = [
  "SUCCEEDED",
  "FAILED",
];

/** 状态驾驶舱分类/模型柱状图（不含失败/取消） */
export const DASHBOARD_CHART_STATUSES: GatewayRequestStatus[] = [
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
];

/** 账期 UTC 半开区间 [from, to) */
export function buildFinancePeriodSubmittedAt(
  from: Date,
  to: Date,
): Prisma.GatewayRequestLogWhereInput {
  return { submittedAt: { gte: from, lt: to } };
}

export function financePeriodFromKey(periodKey: string): {
  periodKey: string;
  from: Date;
  to: Date;
} {
  const { from, to } = periodBounds(periodKey);
  return { periodKey, from, to };
}
