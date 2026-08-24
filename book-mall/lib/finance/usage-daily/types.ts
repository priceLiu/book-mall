import type { ReconStatus } from "@/lib/finance/reconciliation-v2/types";

export type UsageDailyDimension = "TOTAL" | "APP" | "MODEL" | "CREDENTIAL";

export type GatewayDailyRow = {
  day: string;
  dimension: UsageDailyDimension;
  dimensionKey: string;
  dimensionLabel: string;
  requestCount: number;
  failedCount: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCostYuan: number;
};

export type VendorDailyRow = {
  day: string;
  apiKeyName: string;
  channelKey: string;
  modelKey: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  costYuan: number;
};

export type DailyCompareRow = {
  day: string;
  channelKey: string;
  vendorRequests: number;
  gatewayRequests: number;
  requestDiff: number;
  vendorCostYuan: number;
  gatewayCostYuan: number;
  costDiffYuan: number;
  vendorInputTokens: number;
  vendorOutputTokens: number;
  gatewayPromptTokens: number;
  gatewayCompletionTokens: number;
  status: ReconStatus;
  issueReason: string | null;
};

export type UsageManagementSummary = {
  gatewayRequestCount: number;
  gatewayFailedCount: number;
  gatewayEstimatedCostYuan: number;
  vendorRequestCount: number;
  vendorCostYuan: number;
  missingPlatformDays: number;
  alertCount: number;
};

export type UsageManagementGatewayPayload = {
  period: { from: string; to: string };
  summary: UsageManagementSummary;
  gatewayDaily: GatewayDailyRow[];
  platformByApp: GatewayDailyRow[];
  byCredential: GatewayDailyRow[];
  byModel: GatewayDailyRow[];
};

export type UsageManagementComparePayload = {
  period: { from: string; to: string };
  vendorDaily: VendorDailyRow[];
  dailyCompare: DailyCompareRow[];
  alerts: DailyCompareRow[];
  summary: UsageManagementSummary;
};
