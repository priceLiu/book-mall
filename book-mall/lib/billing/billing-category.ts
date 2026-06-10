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

export function billingCategoryLabel(cat: BillingCategory | null | undefined): string {
  if (!cat) return "—";
  return BILLING_CATEGORY_LABEL[cat] ?? cat;
}

/** 将 Gateway 日志映射为七类之一（Single Writer）。 */
export function classifyBillingCategory(log: {
  requestKind: string;
  inputSummary?: unknown;
}): BillingCategory {
  const byok: ByokTaskKind | null = mapLogToByokTaskKind(log);
  if (byok) return byok;
  if (log.requestKind === "CHAT") return "TEXT";
  return "OTHER";
}

/** 从 persisted enum 或日志回退解析类别（报表投影用）。 */
export function resolveBillingCategory(
  log: { requestKind: string; inputSummary?: unknown },
  persisted?: BillingCategory | null,
): BillingCategory {
  if (persisted) return persisted;
  return classifyBillingCategory(log);
}
