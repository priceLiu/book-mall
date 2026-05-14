import type { ToolBillablePrice } from "@prisma/client";

const FALLBACK_MULT = 2;

function finitePositive(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** 无持久化成本/系数时的回落：由标价与成本或默认 M 反推，供表单预填 */
export function inferLegacyCostAndMultForBillableRow(row: ToolBillablePrice): {
  costYuan: number;
  mult: number;
} {
  const retailYuan = row.pricePoints / 100;

  let mult = row.schemeAAdminRetailMultiplier;
  if (!finitePositive(mult)) {
    const c = row.schemeAUnitCostYuan;
    if (c != null && Number.isFinite(c) && c > 0) {
      mult = retailYuan / c;
    } else {
      mult = FALLBACK_MULT;
    }
  }
  if (!finitePositive(mult)) mult = FALLBACK_MULT;

  const costYuan = retailYuan / mult;
  return { costYuan, mult };
}

export async function resolveInitialCostMultForBillableRow(
  row: ToolBillablePrice,
): Promise<{ costYuan: number; mult: number }> {
  const hasCost =
    row.schemeAUnitCostYuan != null &&
    Number.isFinite(row.schemeAUnitCostYuan) &&
    row.schemeAUnitCostYuan >= 0;
  const hasMult =
    row.schemeAAdminRetailMultiplier != null &&
    Number.isFinite(row.schemeAAdminRetailMultiplier) &&
    row.schemeAAdminRetailMultiplier > 0;

  if (hasCost && hasMult) {
    return {
      costYuan: row.schemeAUnitCostYuan!,
      mult: row.schemeAAdminRetailMultiplier!,
    };
  }

  return inferLegacyCostAndMultForBillableRow(row);
}
