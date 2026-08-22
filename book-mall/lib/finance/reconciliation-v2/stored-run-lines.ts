import type { BillingReconciliationLine, BillingReconciliationRun } from "@prisma/client";

import { buildJoinKey } from "./billable-units";
import type { ReconciliationResultRow, ReconciliationV2Summary } from "./types";
import type { TokenDirection, UnitKind } from "./types";

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : fallback;
}

/** 从已落库的 BillingReconciliationLine 还原 v2 对账结果行。 */
export function mapStoredReconciliationLine(
  l: BillingReconciliationLine,
  run: Pick<BillingReconciliationRun, "vendor" | "monthsCovered">,
  summary: ReconciliationV2Summary,
  defaultVendor: string,
): ReconciliationResultRow {
  const vendor = (l.vendor ?? defaultVendor) as string;
  const month = l.periodMonth ?? run.monthsCovered.split(",")[0] ?? "";
  return {
    vendor,
    importVendor: run.vendor ?? defaultVendor,
    joinKey:
      l.joinKey ??
      buildJoinKey({
        vendor,
        modelKey: l.modelKey,
        tierRaw: l.tierRaw,
        unitKind: (l.unitKind ?? l.billingKind) as UnitKind,
        tokenDirection: (l.tokenDirection ?? "none") as TokenDirection,
        month,
      }),
    month,
    period: { from: summary.periodFrom, to: summary.periodTo },
    periodKey: summary.periodKey,
    userId: l.userId,
    cloudAccountId: l.cloudAccountId,
    modelKey: l.modelKey,
    tierRaw: l.tierRaw,
    unitKind: (l.unitKind ?? l.billingKind) as UnitKind,
    tokenDirection: (l.tokenDirection ?? "none") as TokenDirection,
    vendorUnits: num(l.vendorUnits ?? l.cloudCount),
    platformUnits: num(l.platformUnits ?? l.internalCount),
    usageDiff: num(l.usageDiff),
    listUnitYuan: num(l.listUnitYuan),
    vendorListYuan: num(l.vendorListYuan ?? l.cloudPayableYuan),
    platformListYuan: num(l.platformListYuan ?? l.internalYuan),
    platformNetCostYuan: 0,
    amountDiffYuan: num(l.amountDiffYuan ?? l.diffYuan),
    platformCredits: num(l.platformCredits),
    platformRevenueYuan: num(l.platformRevenueYuan),
    reconStatus: (l.reconStatus ?? "OK") as ReconciliationResultRow["reconStatus"],
    issueReason: l.issueReason,
    sampleLogIds: Array.isArray(l.sampleLogIds) ? (l.sampleLogIds as string[]) : [],
  };
}
