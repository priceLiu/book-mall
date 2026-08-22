/**
 * Gateway 日志行净成本 = 单价快照 × 计费单位（张/秒/千Token）。
 */
import { resolveBillableUsageForLog } from "@/lib/gateway/gateway-token-usage-aggregate";
import type { GatewayTokenLogRow } from "@/lib/gateway/gateway-token-usage-aggregate";

export type GatewayLogCostInput = GatewayTokenLogRow & {
  costSnapshotYuan?: unknown;
  estimatedVendorCostYuan?: unknown;
  status?: string | null;
};

export function unitNetCostYuan(log: {
  costSnapshotYuan?: unknown;
  estimatedVendorCostYuan?: unknown;
}): number | null {
  if (log.costSnapshotYuan != null) {
    const n = Number(log.costSnapshotYuan);
    if (Number.isFinite(n)) return n;
  }
  if (log.estimatedVendorCostYuan != null) {
    const n = Number(log.estimatedVendorCostYuan);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** 成功日志的行净成本（元）；失败或未快照时为 0。 */
export function estimateGatewayLogNetCostYuan(log: GatewayLogCostInput): number {
  if (log.status !== "SUCCEEDED") return 0;
  const unit = unitNetCostYuan(log);
  if (unit == null || unit <= 0) return 0;
  const { amount } = resolveBillableUsageForLog(log);
  return unit * amount;
}
