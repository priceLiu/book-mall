import { formatPointsAsYuan, formatPointsIntegerCn } from "@/lib/currency";

/** 管理后台 / 文案：仅 AI智能试衣成片成功上报的 try_on 计入标价扣费。 */
export function isAiFitBillableTryOn(toolKey: string, action: string): boolean {
  return toolKey === "fitting-room__ai-fit" && action === "try_on";
}

export type ToolUsageChargeVariant = "priced" | "nonbill" | "dash";

export function resolveToolUsageChargeVariant(
  toolKey: string,
  action: string,
  costPoints: number | null,
): ToolUsageChargeVariant {
  if (typeof costPoints === "number" && costPoints > 0) return "priced";
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
 * 单行计费数量（默认 1）。若上报 `meta.quantity`（正整数），单价 = costPoints / quantity。
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

export type ToolUsageMoneyCell = {
  variant: ToolUsageChargeVariant;
  /** 主行：点数口径（与 DB `costPoints` 一致） */
  primary: string;
  /** 副行：约合人民币，仅 priced 时有 */
  secondary?: string;
};

/**
 * 明细「扣费」列：库字段为点；展示「点」为主、「元」为辅（与工具管理按次单价同一口径）。
 */
export function formatToolUsageChargeDisplay(
  toolKey: string,
  action: string,
  costPoints: number | null,
): ToolUsageMoneyCell {
  const v = resolveToolUsageChargeVariant(toolKey, action, costPoints);
  if (v === "priced") {
    const pts = costPoints!;
    return {
      variant: "priced",
      primary: `${formatPointsIntegerCn(pts)} 点`,
      secondary: `约合 ¥${formatPointsAsYuan(pts)}`,
    };
  }
  if (v === "nonbill") return { variant: "nonbill", primary: "不计费" };
  return { variant: "dash", primary: "—" };
}

/**
 * 「按次扣点 / 单价」列：已标价时为「每份点数」；quantity>1 时为单价 = costPoints/qty。
 */
export function formatToolUsageUnitPriceDisplay(
  toolKey: string,
  action: string,
  costPoints: number | null,
  meta: unknown,
): ToolUsageMoneyCell {
  const v = resolveToolUsageChargeVariant(toolKey, action, costPoints);
  if (v !== "priced") {
    if (v === "nonbill") return { variant: "nonbill", primary: "不计费" };
    return { variant: "dash", primary: "—" };
  }
  const qty = billingQuantityFromMeta(meta);
  const unitPoints = Math.floor(costPoints! / qty);
  const label = qty > 1 ? `${formatPointsIntegerCn(unitPoints)} 点/份` : `${formatPointsIntegerCn(unitPoints)} 点/次`;
  return {
    variant: "priced",
    primary: label,
    secondary: `约合 ¥${formatPointsAsYuan(unitPoints)}`,
  };
}
