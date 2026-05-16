import type { PricingBillingKind, ToolBillablePrice } from "@prisma/client";

/** 行的"生效状态"：从 active + effectiveFrom/To 与当前时间共同判定，便于 UI 提示哪一行是"当前生效"。 */
export type BillableRowStatus =
  /** active && effectiveFrom ≤ now && (effectiveTo IS NULL || effectiveTo ≥ now)：当前真正用于扣费 */
  | "current"
  /** active && effectiveFrom > now：未来才生效 */
  | "future"
  /** active && effectiveTo 已过：自然过期 */
  | "expired"
  /** active=false：被人为停用 */
  | "inactive";

export type BillableRowPayload = {
  id: string;
  toolKey: string;
  action: string | null;
  schemeARefModelKey: string | null;
  initialCost: number;
  initialMult: number;
  pricePoints: number;
  effectiveFrom: string;
  effectiveTo: string;
  active: boolean;
  note: string | null;
  status: BillableRowStatus;

  /// 与「价目库当前版本」(PricingSourceLine isCurrent=true) 对照得到的成本快照展示。
  /// 若该行未关联或未能映射到 current line，则均为 null。
  cloudModelKey: string | null;
  cloudTierRaw: string | null;
  cloudBillingKind: PricingBillingKind | null;
  /// 计价单位文案（如 "元 / 百万 tokens"、"元 / 张"），由 billingKind/tier 决定
  cloudUnitLabel: string | null;
  /// 当前云厂商成本字符串展示（双轨：TOKEN_IN_OUT 显示 in/out；图按张；视频按秒）
  cloudCostDisplay: string | null;
  /// 与本行 `schemeAUnitCostYuan`（或推断 cost）相比的漂移百分比（云厂商最新 - 本行 / 本行）；null 表示无法对比
  cloudCostDriftPercent: number | null;
};

function formatDatetimeLocalChina(dIso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(dIso));
  const g = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

export type CloudCostOverlay = {
  cloudModelKey: string | null;
  cloudTierRaw: string | null;
  cloudBillingKind: PricingBillingKind | null;
  cloudUnitLabel: string | null;
  cloudCostDisplay: string | null;
  cloudCostDriftPercent: number | null;
};

export type AdminRowInput = Pick<
  ToolBillablePrice,
  | "id"
  | "toolKey"
  | "action"
  | "schemeARefModelKey"
  | "schemeAUnitCostYuan"
  | "schemeAAdminRetailMultiplier"
  | "pricePoints"
  | "effectiveFrom"
  | "effectiveTo"
  | "active"
  | "note"
  | "cloudModelKey"
  | "cloudTierRaw"
  | "cloudBillingKind"
>;

function deriveStatus(row: AdminRowInput, now: Date): BillableRowStatus {
  if (!row.active) return "inactive";
  if (row.effectiveFrom.getTime() > now.getTime()) return "future";
  if (row.effectiveTo && row.effectiveTo.getTime() < now.getTime()) return "expired";
  return "current";
}

export function buildRowPayloads(
  rows: AdminRowInput[],
  initials: Array<{ costYuan: number; mult: number }>,
  overlays?: CloudCostOverlay[],
  now: Date = new Date(),
): BillableRowPayload[] {
  return rows.map((p, i) => {
    const init = initials[i]!;
    const overlay = overlays?.[i] ?? {
      cloudModelKey: p.cloudModelKey,
      cloudTierRaw: p.cloudTierRaw,
      cloudBillingKind: p.cloudBillingKind,
      cloudUnitLabel: null,
      cloudCostDisplay: null,
      cloudCostDriftPercent: null,
    };
    return {
      id: p.id,
      toolKey: p.toolKey,
      action: p.action,
      schemeARefModelKey: p.schemeARefModelKey,
      initialCost: init.costYuan,
      initialMult: init.mult,
      pricePoints: p.pricePoints,
      effectiveFrom: formatDatetimeLocalChina(p.effectiveFrom.toISOString()),
      effectiveTo: p.effectiveTo ? formatDatetimeLocalChina(p.effectiveTo.toISOString()) : "",
      active: p.active,
      note: p.note,
      status: deriveStatus(p, now),
      cloudModelKey: overlay.cloudModelKey,
      cloudTierRaw: overlay.cloudTierRaw,
      cloudBillingKind: overlay.cloudBillingKind,
      cloudUnitLabel: overlay.cloudUnitLabel,
      cloudCostDisplay: overlay.cloudCostDisplay,
      cloudCostDriftPercent: overlay.cloudCostDriftPercent,
    };
  });
}
