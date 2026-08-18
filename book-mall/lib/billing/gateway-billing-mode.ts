/**
 * Gateway 请求计费模式 — 统一平台代付（BYOK 产品已下线）。
 */
import type { CreditBillingMode } from "@prisma/client";

export async function resolveGatewayLogBillingMode(_input: {
  tenantId?: string | null;
  credentialId?: string | null;
  actorBookUserId?: string | null;
}): Promise<CreditBillingMode> {
  return "PLATFORM_CREDIT";
}
