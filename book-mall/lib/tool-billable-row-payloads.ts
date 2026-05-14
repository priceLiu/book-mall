import type { ToolBillablePrice } from "@prisma/client";

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

export function buildRowPayloads(
  rows: Pick<
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
  >[],
  initials: Array<{ costYuan: number; mult: number }>,
): BillableRowPayload[] {
  return rows.map((p, i) => {
    const init = initials[i]!;
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
    };
  });
}
