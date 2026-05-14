import type { ToolBillablePrice } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const FALLBACK_MULTIPLIER = 2;

function finitePositive(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function pickMultiplierFromBillableRow(row: ToolBillablePrice): {
  multiplier: number;
  source: "billable_row" | "derived_from_row" | "fallback_incomplete_row";
} {
  if (finitePositive(row.schemeAAdminRetailMultiplier)) {
    return { multiplier: row.schemeAAdminRetailMultiplier, source: "billable_row" };
  }
  const cost = row.schemeAUnitCostYuan;
  if (cost != null && Number.isFinite(cost) && cost > 0) {
    const retailYuan = row.pricePoints / 100;
    const mult = retailYuan / cost;
    if (finitePositive(mult)) {
      return { multiplier: mult, source: "derived_from_row" };
    }
  }
  return { multiplier: FALLBACK_MULTIPLIER, source: "fallback_incomplete_row" };
}

async function findActiveSchemeABillableRow(
  toolKey: string,
  modelKey: string,
): Promise<ToolBillablePrice | null> {
  const now = new Date();
  const rows = await prisma.toolBillablePrice.findMany({
    where: {
      active: true,
      toolKey,
      schemeARefModelKey: modelKey,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    orderBy: [{ effectiveFrom: "desc" }, { updatedAt: "desc" }],
    take: 4,
  });
  return rows[0] ?? null;
}

export type SchemeARetailMultiplierResolved = {
  multiplier: number;
  /** 命中的 ToolBillablePrice.id；未命中为空 */
  billablePriceId: string | null;
  toolKey: string | null;
  modelKey: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  source:
    | "billable_row"
    | "derived_from_row"
    | "fallback_missing_keys"
    | "fallback_no_row"
    | "fallback_incomplete_row";
};

/**
 * 方案 A 零售系数：仅由当前生效的 {@link ToolBillablePrice}（toolKey + schemeARefModelKey）解析。
 * 无行或缺少 toolKey/modelKey 时回落 2（应急，配置应补齐定价行）。
 */
export async function resolveSchemeARetailMultiplierForToolModel(
  toolKey: string | undefined,
  modelKey: string | undefined,
): Promise<SchemeARetailMultiplierResolved> {
  const tk = toolKey?.trim() ?? "";
  const mk = modelKey?.trim() ?? "";
  if (!tk || !mk) {
    return {
      multiplier: FALLBACK_MULTIPLIER,
      billablePriceId: null,
      toolKey: tk || null,
      modelKey: mk || null,
      effectiveFrom: null,
      effectiveTo: null,
      source: "fallback_missing_keys",
    };
  }

  const row = await findActiveSchemeABillableRow(tk, mk);
  if (!row) {
    return {
      multiplier: FALLBACK_MULTIPLIER,
      billablePriceId: null,
      toolKey: tk,
      modelKey: mk,
      effectiveFrom: null,
      effectiveTo: null,
      source: "fallback_no_row",
    };
  }

  const { multiplier, source } = pickMultiplierFromBillableRow(row);
  return {
    multiplier,
    billablePriceId: row.id,
    toolKey: tk,
    modelKey: mk,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo?.toISOString() ?? null,
    source,
  };
}
