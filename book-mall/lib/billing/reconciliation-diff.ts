/**
 * 对账差异 — 纯函数（无 prisma 依赖，可单测）。
 *
 * 给定「内部成本按 key 汇总」与「厂商账单按 key 汇总」，逐 key 比对产出差异表。
 * 被 credit-reconciliation.ts（按模型 / 按渠道）复用，保证口径一致。
 */
export type ReconStatus = "OK" | "OVER" | "UNDER" | "MISSING_INTERNAL" | "MISSING_VENDOR";

export interface ReconRow {
  key: string;
  internalCostYuan: number;
  vendorCostYuan: number;
  diffYuan: number; // vendor - internal（正 = 厂商收的比内部记的多）
  diffRate: number; // diff / max(vendor, internal)
  status: ReconStatus;
}

export interface ReconResult {
  rows: ReconRow[];
  totalInternal: number;
  totalVendor: number;
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

/**
 * 逐 key 对账差异。
 * @param internalByKey 内部成本（元）按 key
 * @param vendorByKey   厂商账单（元）按 key
 * @param toleranceRate 容差比例（默认 5%），|diffRate| ≤ 容差视为 OK
 */
export function diffReconciliation(
  internalByKey: Map<string, number> | Record<string, number>,
  vendorByKey: Map<string, number> | Record<string, number>,
  toleranceRate = 0.05,
): ReconResult {
  const internal = internalByKey instanceof Map ? internalByKey : new Map(Object.entries(internalByKey));
  const vendor = vendorByKey instanceof Map ? vendorByKey : new Map(Object.entries(vendorByKey));

  const allKeys = new Set<string>([...internal.keys(), ...vendor.keys()]);
  const rows: ReconRow[] = [];
  let totalInternal = 0;
  let totalVendor = 0;

  for (const key of allKeys) {
    const internalCostYuan = internal.get(key) ?? 0;
    const vendorCostYuan = vendor.get(key) ?? 0;
    totalInternal += internalCostYuan;
    totalVendor += vendorCostYuan;
    const diffYuan = vendorCostYuan - internalCostYuan;
    const denom = Math.max(Math.abs(vendorCostYuan), Math.abs(internalCostYuan)) || 1;
    const diffRate = diffYuan / denom;

    let status: ReconStatus;
    if (internalCostYuan === 0) status = "MISSING_INTERNAL";
    else if (vendorCostYuan === 0) status = "MISSING_VENDOR";
    else if (Math.abs(diffRate) <= toleranceRate) status = "OK";
    else if (diffYuan > 0) status = "OVER";
    else status = "UNDER";

    rows.push({
      key,
      internalCostYuan: round6(internalCostYuan),
      vendorCostYuan: round6(vendorCostYuan),
      diffYuan: round6(diffYuan),
      diffRate: round4(diffRate),
      status,
    });
  }

  rows.sort((a, b) => Math.abs(b.diffYuan) - Math.abs(a.diffYuan));
  return { rows, totalInternal: round6(totalInternal), totalVendor: round6(totalVendor) };
}
