/**
 * Finance 2.0：GatewayRequestLog → 账单详情扁平行（v009 列定义）。
 */
import type {
  BillingCategory,
  BillingPersona,
  BillingSettlementKind,
  BillingSettlementLine,
  GatewayRequestLog,
  GatewayRequestKind,
  GatewayRequestStatus,
} from "@prisma/client";

import {
  billingCategoryLabel,
  resolveBillingCategory,
} from "@/lib/billing/billing-category";
import { BILLING_TASK_KIND_LABEL } from "@/lib/billing/gateway-log-classifier";
import { resolveBillableUsageForLog } from "@/lib/gateway/gateway-token-usage-aggregate";
import { estimateGatewayLogNetCostYuan } from "@/lib/finance/gateway-log-line-cost";
import {
  ALL_DISPLAY_KEYS,
  K_CREDITS_CONSUMED,
  K_GATEWAY_KEY,
  K_INCLUDED_REMAINING,
  K_INCLUDED_USED,
  K_MODEL_VENDOR,
  K_QUOTA_DELTA,
  K_SETTLEMENT_KIND,
  K_TASK_KIND,
  K_USER_KEY,
} from "@/lib/finance/bill-display-keys";
import type { GatewayLogKeyLabels } from "@/lib/finance/gateway-bill-key-labels";
import { resolveBillingVendorLabel } from "@/lib/finance/billing-vendor-label";
import {
  billingMonthKeyFromDate,
  formatBillingDateTime,
} from "@/lib/finance/billing-datetime";
import { clientPageToToolLabel } from "@/lib/finance/client-page-tool";

export type GatewayLogBillInput = Pick<
  GatewayRequestLog,
  | "id"
  | "model"
  | "canonicalModelKey"
  | "requestKind"
  | "status"
  | "clientPage"
  | "billingMode"
  | "billingPersonaSnap"
  | "creditsCharged"
  | "costSnapshotYuan"
  | "marginSnapshot"
  | "submittedAt"
  | "completedAt"
  | "actorBookUserId"
  | "settlementKind"
  | "byokTaskKind"
  | "billingCategory"
  | "quotaDelta"
  | "includedUsedAfter"
  | "includedRemainingAfter"
  | "apiKeyId"
  | "credentialId"
  | "credentialAliasSnapshot"
  | "inputSummary"
  | "resultSummary"
  | "totalTokens"
  | "promptTokens"
  | "completionTokens"
  | "hasTokenUsage"
  | "metricsSource"
  | "tenantId"
  | "apiKeyId"
  | "estimatedVendorCostYuan"
  | "failCode"
  | "failMessage"
>;

const STATUS_LABEL: Record<GatewayRequestStatus, string> = {
  PENDING: "待处理",
  RUNNING: "进行中",
  SUCCEEDED: "成功",
  FAILED: "失败",
  CANCELLED: "已取消",
};

const SETTLEMENT_KIND_LABEL: Record<BillingSettlementKind, string> = {
  BYOK_QUOTA_INCLUDED: "历史结算（套餐内）",
  BYOK_QUOTA_OVERAGE: "历史结算（超额）",
  PLATFORM_CREDIT: "平台代付扣积分",
  PLATFORM_VIDEO: "平台代付视频",
  METER_ONLY: "平台计量（不扣积分）",
  NONE: "无扣费/扣次",
};

function ymKeyFromDate(d: Date): string {
  return billingMonthKeyFromDate(d);
}

function formatDateTime(d: Date): string {
  return formatBillingDateTime(d);
}

function requestKindUnit(kind: GatewayRequestKind, category: BillingCategory): string {
  switch (category) {
    case "IMAGE_TO_VIDEO":
    case "VIDEO_TO_VIDEO":
      return "秒";
    case "TEXT_TO_IMAGE":
      return "张";
    case "VIDEO_UNDERSTANDING":
    case "TTS":
    case "TEXT":
      return "千Token";
    default:
      switch (kind) {
        case "VIDEO":
          return "秒";
        case "IMAGE":
        case "TRYON":
          return "张";
        case "CHAT":
        case "TTS":
          return "千Token";
        default:
          return "次";
      }
  }
}

function personaLabel(persona: BillingPersona | null | undefined): string {
  if (persona === "PLATFORM_CREDIT" || persona === "BYOK") return "平台代付";
  return "—";
}

function feeDescription(
  log: GatewayLogBillInput,
  settlement?: BillingSettlementLine | null,
): string {
  const catLabel = billingCategoryLabel(
    resolveBillingCategory(log, settlement?.billingCategory ?? log.billingCategory),
  );
  if (log.status === "FAILED") {
    const reason = (log.failMessage ?? log.failCode ?? "").trim();
    return reason
      ? `调用失败 · ${catLabel} · ${reason.slice(0, 120)}`
      : `调用失败 · ${catLabel}`;
  }
  if (settlement?.feeDescription) return settlement.feeDescription;
  const credits = settlement?.creditsCharged ?? log.creditsCharged ?? 0;
  if (credits > 0) {
    return `平台代付 · ${catLabel} · 扣 ${credits} 积分`;
  }
  return `平台代付 · ${catLabel}（未扣积分）`;
}

function emptyRow(): Record<string, string> {
  const row: Record<string, string> = {};
  for (const k of ALL_DISPLAY_KEYS) row[k] = "";
  return row;
}

function formatMargin(margin: number | null): string {
  if (margin == null || !Number.isFinite(margin)) return "—";
  return `${(margin * 100).toFixed(1)}%`;
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return String(n);
}

/** 单行 Gateway 日志 → v009 扁平展示行。 */
export function projectGatewayLogToBillRow(
  log: GatewayLogBillInput,
  platformUserId: string,
  platformUserLabel: string,
  modelDisplayNames: ReadonlyMap<string, string>,
  settlement?: BillingSettlementLine | null,
  modelVendors?: ReadonlyMap<string, string>,
  quotaSnapshotOverride?: {
    includedUsedAfter: number;
    includedRemainingAfter: number;
  } | null,
  keyLabels?: GatewayLogKeyLabels | null,
): Record<string, string> {
  const row = emptyRow();
  const modelKey = log.canonicalModelKey ?? log.model ?? "";
  const displayName = modelDisplayNames.get(modelKey) ?? modelKey;
  const toolLabel = clientPageToToolLabel(log.clientPage);
  const credits = settlement?.creditsCharged ?? log.creditsCharged ?? 0;
  const lineNetCost = estimateGatewayLogNetCostYuan(log);
  const margin = log.marginSnapshot != null ? Number(log.marginSnapshot) : null;
  const submitted = log.submittedAt;
  const modelName =
    toolLabel && toolLabel !== "—" ? `${displayName} · ${toolLabel}` : displayName;

  const settlementKind = settlement?.settlementKind ?? log.settlementKind;
  const billingCategory = resolveBillingCategory(
    log,
    settlement?.billingCategory ?? log.billingCategory,
  );
  const categoryLabel = billingCategoryLabel(billingCategory);

  row["平台/用户ID"] = platformUserId;
  row["平台/用户名"] = platformUserLabel;
  row["平台/工具页面"] = log.clientPage ?? "—";
  row[K_MODEL_VENDOR] = resolveBillingVendorLabel(
    modelKey,
    modelVendors?.get(modelKey),
  );
  row[K_GATEWAY_KEY] = keyLabels?.gatewayKey ?? "--";
  row[K_USER_KEY] = keyLabels?.userKey ?? "--";
  row["平台/模型Code"] = modelKey;
  row["平台/模型名称"] = modelName;
  row["平台/请求类型"] = categoryLabel;
  row[K_CREDITS_CONSUMED] = String(credits);
  row["平台/计费身份"] = personaLabel(log.billingPersonaSnap);
  row["平台/状态"] = STATUS_LABEL[log.status] ?? log.status;
  row["平台/Gateway日志ID"] = log.id;
  row["平台/行来源"] = "Gateway";

  row["平台账单/账单月份"] = ymKeyFromDate(submitted);
  row["平台账单/消费时间"] = formatDateTime(submitted);

  row[K_SETTLEMENT_KIND] = settlementKind
    ? SETTLEMENT_KIND_LABEL[settlementKind]
    : "—";

  const byokTaskKind = settlement?.byokTaskKind ?? log.byokTaskKind;
  row[K_TASK_KIND] =
    byokTaskKind && byokTaskKind in BILLING_TASK_KIND_LABEL
      ? BILLING_TASK_KIND_LABEL[byokTaskKind as keyof typeof BILLING_TASK_KIND_LABEL]
      : categoryLabel;

  row[K_QUOTA_DELTA] = fmtNum(settlement?.quotaDelta ?? log.quotaDelta);
  row[K_INCLUDED_USED] = fmtNum(
    settlement?.includedUsedAfter ?? log.includedUsedAfter,
  );
  row[K_INCLUDED_REMAINING] = fmtNum(
    settlement?.includedRemainingAfter ?? log.includedRemainingAfter,
  );

  row["平台账单/费用说明"] = feeDescription(log, settlement);

  const { amount: usageUnits } = resolveBillableUsageForLog(log);
  row["平台用量/用量"] = String(usageUnits);
  row["平台用量/用量单位"] = requestKindUnit(log.requestKind, billingCategory);

  row["财务核算/净成本(元)"] = lineNetCost > 0 ? lineNetCost.toFixed(6) : "—";
  row["财务核算/毛利率"] = formatMargin(margin);

  return row;
}

/** 批量加载 canonicalModelKey → displayName / vendor。 */
export async function loadModelCatalogBillMaps(
  keys: string[],
  prisma: {
    modelCatalog: {
      findMany: (args: {
        where: { canonicalKey: { in: string[] } };
        select: { canonicalKey: true; displayName: true; vendor: true };
      }) => Promise<
        { canonicalKey: string; displayName: string; vendor: string }[]
      >;
    };
  },
): Promise<{
  displayNames: Map<string, string>;
  vendors: Map<string, string>;
}> {
  const uniq = [...new Set(keys.filter(Boolean))];
  if (uniq.length === 0) {
    return { displayNames: new Map(), vendors: new Map() };
  }
  const rows = await prisma.modelCatalog.findMany({
    where: { canonicalKey: { in: uniq } },
    select: { canonicalKey: true, displayName: true, vendor: true },
  });
  return {
    displayNames: new Map(rows.map((r) => [r.canonicalKey, r.displayName])),
    vendors: new Map(rows.map((r) => [r.canonicalKey, r.vendor])),
  };
}

/** @deprecated 使用 loadModelCatalogBillMaps */
export async function loadModelDisplayNameMap(
  keys: string[],
  prisma: Parameters<typeof loadModelCatalogBillMaps>[1],
): Promise<Map<string, string>> {
  const { displayNames } = await loadModelCatalogBillMaps(keys, prisma);
  return displayNames;
}
