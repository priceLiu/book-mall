/**
 * AI 小智（平台导览助手）· 财务对帐归口。
 * 平台代付 Key 不计用户积分，但须单独计量供 admin 用户明细对帐。
 */
import type { GatewayRequestLog, Prisma } from "@prisma/client";

import {
  billingCategoryLabel,
  classifyBillingCategory,
} from "@/lib/billing/billing-category";
import { recordBillingSettlement } from "@/lib/billing/billing-settlement-service";
import { isPlatformOperationalApiKey } from "@/lib/gateway/platform-operational-api-key";
import { clientPageToToolLabel } from "@/lib/finance/client-page-tool";
import { PLATFORM_ASSISTANT_CLIENT_PAGE_PREFIX } from "@/lib/platform-assistant/platform-assistant-constants";

/** finance-web / admin 账单明细用的虚拟用户 ID（非 Book User 表行）。 */
export const PLATFORM_ASSISTANT_BILLING_USER_ID = "platform-assistant";

export const PLATFORM_ASSISTANT_BILLING_USER_LABEL = "AI 小智";

export { PLATFORM_ASSISTANT_CLIENT_PAGE_PREFIX } from "@/lib/platform-assistant/platform-assistant-constants";

export function isPlatformAssistantClientPage(
  clientPage: string | null | undefined,
): boolean {
  return !!clientPage?.startsWith(PLATFORM_ASSISTANT_CLIENT_PAGE_PREFIX);
}

export function excludePlatformAssistantClientPageFilter(): Prisma.GatewayRequestLogWhereInput {
  return { NOT: { clientPage: { startsWith: PLATFORM_ASSISTANT_CLIENT_PAGE_PREFIX } } };
}

export function buildPlatformAssistantGatewayLogWhere(
  filters?: Prisma.GatewayRequestLogWhereInput,
): Prisma.GatewayRequestLogWhereInput {
  const parts: Prisma.GatewayRequestLogWhereInput[] = [
    { clientPage: { startsWith: PLATFORM_ASSISTANT_CLIENT_PAGE_PREFIX } },
  ];
  if (filters && Object.keys(filters).length > 0) parts.push(filters);
  return parts.length === 1 ? parts[0]! : { AND: parts };
}

function buildPlatformAssistantFeeDescription(log: GatewayRequestLog): string {
  const catLabel = billingCategoryLabel(classifyBillingCategory(log));
  const pageLabel = clientPageToToolLabel(log.clientPage);
  const actorSuffix = log.actorBookUserId
    ? ` · 触发用户 ${log.actorBookUserId.slice(0, 8)}…`
    : "";
  return `AI 小智 · ${pageLabel} · ${catLabel}（平台代付计量，不扣用户积分）${actorSuffix}`;
}

/** 成功调用写入 METER_ONLY 结算流水（幂等，owner=虚拟 AI 小智）。 */
export async function recordPlatformAssistantMeterSettlement(
  log: GatewayRequestLog,
  opts?: { skipOperationalKeyCheck?: boolean },
) {
  if (!isPlatformAssistantClientPage(log.clientPage)) return null;
  if (log.status !== "SUCCEEDED") return null;
  if (
    !opts?.skipOperationalKeyCheck &&
    !(await isPlatformOperationalApiKey(log.apiKeyId))
  ) {
    return null;
  }

  return recordBillingSettlement({
    log,
    ref: { ownerType: "USER", ownerId: PLATFORM_ASSISTANT_BILLING_USER_ID },
    settlementKind: "METER_ONLY",
    creditsCharged: 0,
    billingCategory: classifyBillingCategory(log),
    feeDescription: buildPlatformAssistantFeeDescription(log),
  });
}
