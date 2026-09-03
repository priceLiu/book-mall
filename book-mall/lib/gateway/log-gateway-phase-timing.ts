import {
  resolveDashscopeLogTiming,
  resolveDashscopeVendorNativeTimingForLogRow,
} from "@/lib/gateway/log-dashscope-timing";
import {
  resolveMinimaxLogTiming,
  resolveMinimaxVendorNativeTimingForLogRow,
} from "@/lib/gateway/log-minimax-timing";
import {
  resolveVolcengineLogTiming,
  resolveVendorNativeTimingForLogRow,
  type VolcengineTimingBreakdown,
} from "@/lib/gateway/log-volcengine-timing";

/** 日志 API · 厂商分阶段耗时（火山 / 百炼 / DashScope） */
export function resolveGatewayLogPhaseTiming(input: {
  providerKind: string | null;
  requestKind: string;
  submittedAt: Date;
  completedAt: Date | null;
  resultSummary: unknown;
  nowMs?: number;
}): VolcengineTimingBreakdown | null {
  return (
    resolveVolcengineLogTiming(input) ??
    resolveDashscopeLogTiming(input) ??
    resolveMinimaxLogTiming(input)
  );
}

export function resolveGatewayVendorNativeTimingForLogRow(input: {
  providerKind: string | null;
  requestKind: string;
  vendorDurationMs: number | null;
  resultSummary: unknown;
  nowMs?: number;
}): {
  vendorNativeDurationMs: number | null;
  vendorNativeGenerateMs: number | null;
} {
  const volc = resolveVendorNativeTimingForLogRow(input);
  if (
    volc.vendorNativeDurationMs != null ||
    volc.vendorNativeGenerateMs != null
  ) {
    return volc;
  }
  const dash = resolveDashscopeVendorNativeTimingForLogRow(input);
  if (
    dash.vendorNativeDurationMs != null ||
    dash.vendorNativeGenerateMs != null
  ) {
    return dash;
  }
  return resolveMinimaxVendorNativeTimingForLogRow(input);
}
