/**
 * 厂商 CSV 对账上传后的即时告警：
 * dailyCompare 出现 MISSING_PLATFORM / UNDER_PLATFORM（厂商有、平台少 → 直连嫌疑）
 * 或 MISSING_VENDOR / OVER_PLATFORM → 写 PlatformErrorLog（USAGE_RECON_MISMATCH）。
 */
import { recordPlatformError } from "@/lib/platform-error-log";

import type { DailyCompareRow } from "./types";

export function reportVendorReconAlerts(input: {
  period: { from: string; to: string };
  dailyCompare: DailyCompareRow[];
}): number {
  const alerts = input.dailyCompare.filter(
    (r) =>
      r.status === "MISSING_PLATFORM" ||
      r.status === "UNDER_PLATFORM" ||
      r.status === "MISSING_VENDOR" ||
      r.status === "OVER_PLATFORM",
  );
  if (alerts.length === 0) return 0;

  const worst = alerts.filter((r) => r.status === "MISSING_PLATFORM");
  recordPlatformError({
    source: "SYSTEM",
    severity: worst.length > 0 ? "ERROR" : "WARN",
    code: "USAGE_RECON_MISMATCH",
    message:
      `厂商 vs Gateway 日对账差异（${input.period.from}~${input.period.to}）：` +
      `${alerts.length} 行异常` +
      (worst.length > 0 ? `，其中 ${worst.length} 行厂商有量但平台无记录（直连嫌疑）` : ""),
    detail: JSON.stringify(
      alerts.map((r) => ({
        day: r.day,
        channel: r.channelKey,
        status: r.status,
        vendorRequests: r.vendorRequests,
        gatewayRequests: r.gatewayRequests,
        issueReason: r.issueReason,
      })),
      null,
      2,
    ),
    context: {
      periodFrom: input.period.from,
      periodTo: input.period.to,
      alertRows: alerts.length,
    },
  });
  return alerts.length;
}
