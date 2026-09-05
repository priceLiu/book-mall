import {
  assertGatewayApiKeyLinkedForUser,
  resolveGatewayAuthForBookUser,
} from "@/lib/gateway/book-gateway-link";
import type { GatewayProviderKind } from "@prisma/client";
import { assertPlatformGatewayEntitlement } from "@/lib/platform-gateway-entitlement";
import { ECOM_TOOLKIT_NAV_KEY } from "@/lib/ecom/ecom-access";
import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { ensurePlatformManagedKeyForUser } from "@/lib/gateway/platform-managed-key";
import { prisma } from "@/lib/prisma";

/** 电商工具箱 Gateway 调用前准入 */
export async function assertEcomToolkitGatewayAccess(userId: string): Promise<void> {
  await assertPlatformGatewayEntitlement(userId, {
    navKey: ECOM_TOOLKIT_NAV_KEY,
  });
  await assertGatewayApiKeyLinkedForUser(userId);
}

/** PLATFORM_CREDIT 走 per-user 托管 sk-gw；BYOK 走用户自建 Key */
export async function resolveEcomGatewayAuthForUser(userId: string) {
  const persona = await getUserBillingPersona(userId);
  if (persona === "PLATFORM_CREDIT" || persona === null) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { billingPersona: true },
    });
    if (persona === "PLATFORM_CREDIT" || user?.billingPersona === "PLATFORM_CREDIT") {
      await ensurePlatformManagedKeyForUser(userId);
    }
  }
  return resolveGatewayAuthForBookUser(userId);
}

/** 模型选择器：用 sk-gw 实际绑定的厂商（含 PLATFORM_CREDIT 托管 Key），勿传空 boundKinds */
export async function resolveEcomGatewayBoundKindsForModelPicker(
  userId: string,
): Promise<GatewayProviderKind[]> {
  const gw = await resolveEcomGatewayAuthForUser(userId);
  const kinds = gw?.credentials.map((c) => c.providerKind) ?? [];
  return [...new Set(kinds)];
}
