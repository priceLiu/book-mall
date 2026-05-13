import { formatMinorAsYuan } from "@/lib/currency";

/** 管理后台 / 文案：仅 AI智能试衣成片成功上报的 try_on 计入标价扣费。 */
export function isAiFitBillableTryOn(toolKey: string, action: string): boolean {
  return toolKey === "fitting-room__ai-fit" && action === "try_on";
}

export type ToolUsageChargeVariant = "priced" | "nonbill" | "dash";

export function resolveToolUsageChargeVariant(
  toolKey: string,
  action: string,
  costMinor: number | null,
): ToolUsageChargeVariant {
  if (typeof costMinor === "number" && costMinor > 0) return "priced";
  if (action === "page_view") return "nonbill";
  if (
    toolKey === "fitting-room" ||
    toolKey.startsWith("fitting-room__ai-fit__closet") ||
    toolKey.startsWith("text-to-image__library") ||
    toolKey === "app-history"
  ) {
    return "nonbill";
  }
  return "dash";
}

/**
 * 单行计费数量（默认 1）。若上报 `meta.quantity`（正整数），单价 = costMinor / quantity。
 */
export function billingQuantityFromMeta(meta: unknown): number {
  if (meta == null || typeof meta !== "object" || Array.isArray(meta)) return 1;
  const raw = (meta as Record<string, unknown>).quantity;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 1) {
    return Math.max(1, Math.floor(raw));
  }
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    const n = parseInt(raw.trim(), 10);
    if (n >= 1) return n;
  }
  return 1;
}

/**
 * 明细「AI扣费」列：有金额优先展示；浏览与非计费入口展示「不计费」；其余未标价展示「—」。
 */
export function formatToolUsageChargeDisplay(
  toolKey: string,
  action: string,
  costMinor: number | null,
): { variant: "money" | "dash" | "nonbill"; text: string } {
  const v = resolveToolUsageChargeVariant(toolKey, action, costMinor);
  if (v === "priced") {
    return { variant: "money", text: `¥${formatMinorAsYuan(costMinor!)}` };
  }
  if (v === "nonbill") return { variant: "nonbill", text: "不计费" };
  return { variant: "dash", text: "—" };
}

/**
 * 「单价」列：已标价时为单价（元）；口径与扣费列的非计费展示一致。
 */
export function formatToolUsageUnitPriceDisplay(
  toolKey: string,
  action: string,
  costMinor: number | null,
  meta: unknown,
): { variant: "money" | "dash" | "nonbill"; text: string } {
  const v = resolveToolUsageChargeVariant(toolKey, action, costMinor);
  if (v !== "priced") {
    if (v === "nonbill") return { variant: "nonbill", text: "不计费" };
    return { variant: "dash", text: "—" };
  }
  const qty = billingQuantityFromMeta(meta);
  const unitMinor = Math.floor(costMinor! / qty);
  return { variant: "money", text: `¥${formatMinorAsYuan(unitMinor)}` };
}
