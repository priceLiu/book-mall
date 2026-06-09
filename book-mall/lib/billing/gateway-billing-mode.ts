/**
 * Gateway 请求计费模式 — 由 billingPersona 强制，禁止 credentialId 推断混用
 */
import type { CreditBillingMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isUnifiedCreditBillingActive } from "./unified-credit-flag";

async function resolvePersonaForLog(input: {
  tenantId?: string | null;
  actorBookUserId?: string | null;
}): Promise<"PLATFORM_CREDIT" | "BYOK" | null> {
  if (input.actorBookUserId) {
    const user = await prisma.user.findUnique({
      where: { id: input.actorBookUserId },
      select: { billingPersona: true, billingPersonaLockedAt: true },
    });
    if (user?.billingPersonaLockedAt) return user.billingPersona;
  }

  if (input.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { ownerUserId: true },
    });
    if (tenant?.ownerUserId) {
      const owner = await prisma.user.findUnique({
        where: { id: tenant.ownerUserId },
        select: { billingPersona: true, billingPersonaLockedAt: true },
      });
      if (owner?.billingPersonaLockedAt) return owner.billingPersona;
    }
  }

  return null;
}

export async function resolveGatewayLogBillingMode(input: {
  tenantId?: string | null;
  credentialId?: string | null;
  actorBookUserId?: string | null;
}): Promise<CreditBillingMode> {
  if (!isUnifiedCreditBillingActive()) return "BYOK";

  const persona = await resolvePersonaForLog(input);
  if (persona === "BYOK") return "BYOK";
  if (persona === "PLATFORM_CREDIT") return "PLATFORM_CREDIT";

  // 未锁定 persona 的存量兼容：团队 → 平台代付
  if (input.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { type: true },
    });
    if (tenant?.type === "TEAM") return "PLATFORM_CREDIT";
  }

  return "BYOK";
}
