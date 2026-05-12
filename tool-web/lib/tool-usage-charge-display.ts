/**
 * 与主站 book-mall `tool-usage-charge-display` 口径一致（单价金额用分数换算为元）。
 */
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

export function formatToolUsageChargeDisplay(
  toolKey: string,
  action: string,
  costMinor: number | null,
): { variant: "money" | "dash" | "nonbill"; text: string } {
  const v = resolveToolUsageChargeVariant(toolKey, action, costMinor);
  if (v === "priced") {
    return {
      variant: "money",
      text: `−¥${(costMinor! / 100).toFixed(2)}`,
    };
  }
  if (v === "nonbill") return { variant: "nonbill", text: "不计费" };
  return { variant: "dash", text: "—" };
}

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
  return {
    variant: "money",
    text: `¥${(unitMinor / 100).toFixed(2)}`,
  };
}
