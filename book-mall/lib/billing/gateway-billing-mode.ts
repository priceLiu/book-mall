/**
 * Gateway 请求计费模式（unified-credit-billing）
 *
 * - 使用用户/团队自备厂商凭证 → BYOK（套餐额度 + 超额轻量包）
 * - TEAM 租户 + 平台代付 → PLATFORM_CREDIT
 * - 个人 / 未传租户 → BYOK
 */
import type { CreditBillingMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isUnifiedCreditBillingActive } from "./unified-credit-flag";

export async function resolveGatewayLogBillingMode(input: {
  tenantId?: string | null;
  credentialId?: string | null;
}): Promise<CreditBillingMode> {
  if (!isUnifiedCreditBillingActive()) return "BYOK";

  // 绑定用户/团队厂商 Key → BYOK（含团队每席计费）
  if (input.credentialId) {
    const cred = await prisma.gatewayVendorCredential.findUnique({
      where: { id: input.credentialId },
      select: { id: true },
    });
    if (cred) return "BYOK";
  }

  if (!input.tenantId) return "BYOK";

  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { type: true },
  });
  return tenant?.type === "TEAM" ? "PLATFORM_CREDIT" : "BYOK";
}
