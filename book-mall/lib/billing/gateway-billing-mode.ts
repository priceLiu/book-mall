/**
 * Gateway 请求计费模式（unified-credit-billing）
 *
 * - TEAM 租户：共享积分池 → PLATFORM_CREDIT（生成前预检 + 成功后结算）
 * - PERSONAL / 未传租户：工具月费 + 自备厂商 Key → BYOK（不按次扣积分）
 */
import type { CreditBillingMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isUnifiedCreditBillingActive } from "./unified-credit-flag";

export async function resolveGatewayLogBillingMode(input: {
  tenantId?: string | null;
}): Promise<CreditBillingMode> {
  if (!isUnifiedCreditBillingActive()) return "BYOK";
  if (!input.tenantId) return "BYOK";

  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { type: true },
  });
  return tenant?.type === "TEAM" ? "PLATFORM_CREDIT" : "BYOK";
}
