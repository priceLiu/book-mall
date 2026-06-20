/**
 * 七类计费 taxonomy（BYOK + 平台代付报表/结算共用）。
 * 权威映射表：docs/定价与风控.md §7.1、§7.2
 */
import type { BillingCategory, ByokTaskKind } from "@prisma/client";

import { BYOK_TASK_KIND_LABEL, mapLogToByokTaskKind } from "@/lib/billing/byok-pricing";

export type BillingCategoryKey = BillingCategory;

/** 七类展示标签（含 TEXT / OTHER）。 */
export const BILLING_CATEGORY_LABEL: Record<BillingCategory, string> = {
  ...BYOK_TASK_KIND_LABEL,
  TEXT: "文字",
  OTHER: "其他",
};

/** 固定展示顺序（个人中心 / 财务聚合）。 */
export const BILLING_CATEGORY_ORDER: BillingCategory[] = [
  "TEXT_TO_IMAGE",
  "IMAGE_TO_VIDEO",
  "VIDEO_TO_VIDEO",
  "VIDEO_UNDERSTANDING",
  "TTS",
  "TEXT",
  "OTHER",
];

/** 驾驶舱 / 报表图表：仅展示收费大类型，不含 OTHER。 */
export const BILLING_CATEGORY_CHART_ORDER: BillingCategory[] =
  BILLING_CATEGORY_ORDER.filter((c) => c !== "OTHER");

/** 驾驶舱专用：人像库入库（不计入文生图张数；财务归「其他 · 次」）。 */
export const DASHBOARD_PORTRAIT_IMPORT_CATEGORY = "PORTRAIT_IMPORT" as const;

export type DashboardChartCategoryKey =
  | BillingCategory
  | typeof DASHBOARD_PORTRAIT_IMPORT_CATEGORY;

/** 状态驾驶舱柱状图顺序（含人像入库）。 */
export const DASHBOARD_STATUS_CHART_ORDER: DashboardChartCategoryKey[] = [
  "TEXT_TO_IMAGE",
  DASHBOARD_PORTRAIT_IMPORT_CATEGORY,
  "IMAGE_TO_VIDEO",
  "VIDEO_TO_VIDEO",
  "VIDEO_UNDERSTANDING",
  "TTS",
  "TEXT",
];

export function dashboardStatusChartCategoryLabel(
  cat: DashboardChartCategoryKey,
): string {
  if (cat === DASHBOARD_PORTRAIT_IMPORT_CATEGORY) return "人像入库";
  return billingCategoryLabel(cat);
}

export function billingCategoryLabel(cat: BillingCategory | null | undefined): string {
  if (!cat) return "—";
  return BILLING_CATEGORY_LABEL[cat] ?? cat;
}

export type DashboardChartLogInput = {
  requestKind: string;
  inputSummary?: unknown;
  model?: string | null;
};

/** 将 Gateway 日志映射为七类之一（Single Writer）。 */
export function classifyBillingCategory(log: DashboardChartLogInput): BillingCategory {
  const byok: ByokTaskKind | null = mapLogToByokTaskKind(log);
  if (byok) return byok;
  if (log.requestKind === "CHAT") return "TEXT";
  return "OTHER";
}

/** 从 persisted enum 或日志回退解析类别（报表投影用）。 */
export function resolveBillingCategory(
  log: DashboardChartLogInput,
  persisted?: BillingCategory | null,
): BillingCategory {
  if (persisted) return persisted;
  return classifyBillingCategory(log);
}

/** 私域/真人人像库 Gateway（model=portrait:*，requestKind=OTHER）。 */
export function isPortraitLibraryGatewayLog(log: DashboardChartLogInput): boolean {
  const fromModel = typeof log.model === "string" ? log.model.trim() : "";
  if (fromModel === "portrait:virtual" || fromModel === "portrait:real") {
    return true;
  }
  const summary = log.inputSummary;
  if (summary && typeof summary === "object" && !Array.isArray(summary)) {
    const nested = (summary as { model?: unknown }).model;
    if (nested === "portrait:virtual" || nested === "portrait:real") return true;
  }
  return false;
}

/**
 * 驾驶舱图表专用：始终归入收费大类型，不展示 OTHER。
 *  persisted=OTHER 或无法映射时，按 requestKind / model 回退。
 */
export function resolveDashboardChartCategory(
  log: DashboardChartLogInput,
  persisted?: BillingCategory | null,
): DashboardChartCategoryKey {
  const raw =
    persisted && persisted !== "OTHER"
      ? persisted
      : classifyBillingCategory(log);
  if (raw !== "OTHER") return raw;
  if (isPortraitLibraryGatewayLog(log)) return DASHBOARD_PORTRAIT_IMPORT_CATEGORY;
  if (log.requestKind === "VIDEO") {
    return mapLogToByokTaskKind(log) ?? "IMAGE_TO_VIDEO";
  }
  if (log.requestKind === "IMAGE" || log.requestKind === "TRYON") {
    return "TEXT_TO_IMAGE";
  }
  if (log.requestKind === "TTS") return "TTS";
  if (log.requestKind === "CHAT") return "TEXT";
  return "TEXT";
}
