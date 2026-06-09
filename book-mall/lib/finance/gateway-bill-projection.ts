/**
 * Finance 2.0：GatewayRequestLog → 账单详情扁平行（v009 列定义）。
 */
import type { BillingPersona, GatewayRequestLog, GatewayRequestKind, GatewayRequestStatus } from "@prisma/client";

import { ALL_DISPLAY_KEYS, K_CREDITS_CONSUMED } from "@/lib/finance/bill-display-keys";
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
>;

const STATUS_LABEL: Record<GatewayRequestStatus, string> = {
  PENDING: "待处理",
  RUNNING: "进行中",
  SUCCEEDED: "成功",
  FAILED: "失败",
  CANCELLED: "已取消",
};

const REQUEST_KIND_LABEL: Record<string, string> = {
  CHAT: "对话",
  IMAGE: "生图",
  VIDEO: "生视频",
  TRYON: "AI试衣",
  TTS: "语音",
  OTHER: "其他",
};

function ymKeyFromDate(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatDateTime(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19);
}

function requestKindUnit(kind: GatewayRequestKind): string {
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

function personaLabel(persona: BillingPersona | null | undefined): string {
  if (persona === "BYOK") return "自带 Key（BYOK）";
  if (persona === "PLATFORM_CREDIT") return "平台代付";
  return "—";
}

function feeDescription(log: GatewayLogBillInput): string {
  const credits = log.creditsCharged ?? 0;
  if (log.billingPersonaSnap === "BYOK") {
    return credits > 0 ? "BYOK 超额 · 扣积分" : "BYOK 套餐内（0 积分）";
  }
  if (log.billingPersonaSnap === "PLATFORM_CREDIT") {
    return credits > 0 ? "平台代付 · 扣积分" : "平台代付（未扣积分）";
  }
  if (log.billingMode === "BYOK") {
    return credits > 0 ? "BYOK 超额 · 扣积分" : "BYOK 套餐内";
  }
  return credits > 0 ? "扣积分" : "成功调用（0 积分）";
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

/** 单行 Gateway 日志 → v009 扁平展示行。 */
export function projectGatewayLogToBillRow(
  log: GatewayLogBillInput,
  platformUserId: string,
  platformUserLabel: string,
  modelDisplayNames: ReadonlyMap<string, string>,
): Record<string, string> {
  const row = emptyRow();
  const modelKey = log.canonicalModelKey ?? log.model ?? "";
  const displayName = modelDisplayNames.get(modelKey) ?? modelKey;
  const toolLabel = clientPageToToolLabel(log.clientPage);
  const credits = log.creditsCharged ?? 0;
  const costYuan = log.costSnapshotYuan != null ? Number(log.costSnapshotYuan) : null;
  const margin = log.marginSnapshot != null ? Number(log.marginSnapshot) : null;
  const submitted = log.submittedAt;
  const modelName =
    toolLabel && toolLabel !== "—" ? `${displayName} · ${toolLabel}` : displayName;

  row["平台/用户ID"] = platformUserId;
  row["平台/用户名"] = platformUserLabel;
  row["平台/工具页面"] = log.clientPage ?? "—";
  row["平台/模型Code"] = modelKey;
  row["平台/模型名称"] = modelName;
  row["平台/请求类型"] = REQUEST_KIND_LABEL[log.requestKind] ?? log.requestKind;
  row[K_CREDITS_CONSUMED] = String(credits);
  row["平台/计费身份"] = personaLabel(log.billingPersonaSnap);
  row["平台/状态"] = STATUS_LABEL[log.status] ?? log.status;
  row["平台/Gateway日志ID"] = log.id;
  row["平台/行来源"] = "Gateway";

  row["平台账单/账单月份"] = ymKeyFromDate(submitted);
  row["平台账单/消费时间"] = formatDateTime(submitted);
  row["平台账单/费用说明"] = feeDescription(log);

  row["平台用量/用量"] = "1";
  row["平台用量/用量单位"] = requestKindUnit(log.requestKind);

  row["财务核算/净成本(元)"] = costYuan != null ? costYuan.toFixed(6) : "—";
  row["财务核算/毛利率"] = formatMargin(margin);

  return row;
}

/** 批量加载 canonicalModelKey → displayName。 */
export async function loadModelDisplayNameMap(
  keys: string[],
  prisma: {
    modelCatalog: {
      findMany: (args: {
        where: { canonicalKey: { in: string[] } };
        select: { canonicalKey: true; displayName: true };
      }) => Promise<{ canonicalKey: string; displayName: string }[]>;
    };
  },
): Promise<Map<string, string>> {
  const uniq = [...new Set(keys.filter(Boolean))];
  if (uniq.length === 0) return new Map();
  const rows = await prisma.modelCatalog.findMany({
    where: { canonicalKey: { in: uniq } },
    select: { canonicalKey: true, displayName: true },
  });
  return new Map(rows.map((r) => [r.canonicalKey, r.displayName]));
}
