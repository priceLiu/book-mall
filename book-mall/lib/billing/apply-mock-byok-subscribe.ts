/**
 * 开发环境模拟 BYOK 套餐开通/续订。
 */
import {
  activateByokSubscription,
  resolveByokSeatsForTenant,
} from "@/lib/billing/byok-subscription-service";
import { assertBillingPersona } from "@/lib/billing/billing-persona";
import {
  BYOK_SCOPE_PERSONAL,
  BYOK_SCOPE_TEAM_SEAT,
} from "@/lib/billing/byok-pricing";
import { canTenant } from "@/lib/tenant/permission";
import { recordAdminPaidByokCheckout } from "@/lib/payments/record-admin-paid-byok-checkout";
import { prisma } from "@/lib/prisma";

export type ByokSubscribeTarget = "personal" | "team";

export async function applyMockByokSubscribe(input: {
  userId: string;
  scopeKey: string;
  target: ByokSubscribeTarget;
  tenantId?: string | null;
  seats?: number;
}) {
  const scopeKey = input.scopeKey.trim();
  if (scopeKey !== BYOK_SCOPE_PERSONAL && scopeKey !== BYOK_SCOPE_TEAM_SEAT) {
    throw new Error("无效的 BYOK 档位");
  }

  await assertBillingPersona(input.userId, "BYOK");

  let ownerType: "USER" | "TENANT" = "USER";
  let ownerId = input.userId;
  let seats = 1;

  if (input.target === "team" || scopeKey === BYOK_SCOPE_TEAM_SEAT) {
    if (!input.tenantId) throw new Error("请选择团队");
    const member = await prisma.tenantMember.findFirst({
      where: { userId: input.userId, tenantId: input.tenantId, status: "ACTIVE" },
      include: { tenant: { select: { type: true, status: true, name: true } } },
    });
    if (!member || member.tenant.type !== "TEAM" || member.tenant.status !== "ACTIVE") {
      throw new Error("你不是该团队的活跃成员");
    }
    if (!canTenant(member.role, "billing:manage")) {
      throw new Error("仅团队主账号可开通团队 BYOK");
    }
    ownerType = "TENANT";
    ownerId = input.tenantId;
    seats = input.seats
      ? Math.max(1, Math.round(input.seats))
      : await resolveByokSeatsForTenant(input.tenantId);
  }

  const orderId = `mock_byok_${crypto.randomUUID()}`;
  const result = await activateByokSubscription({
    ownerType,
    ownerId,
    scopeKey,
    seats,
    orderId,
  });

  const audit = await recordAdminPaidByokCheckout({
    userId: input.userId,
    scopeKey,
    tenantId: ownerType === "TENANT" ? ownerId : null,
    seats,
    confirmedByUserId: input.userId,
    source: "MOCK",
    subscriptionId: result.subscriptionId,
    paidAt: new Date(),
  });

  return {
    ...result,
    ownerType,
    ownerId,
    paymentCheckoutId: audit.checkoutId,
    paymentOrderId: audit.orderId,
  };
}
