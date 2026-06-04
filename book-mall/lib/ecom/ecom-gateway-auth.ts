import {
  assertGatewayApiKeyLinkedForUser,
  GatewayRequiredError,
  resolveGatewayAuthForBookUser,
} from "@/lib/gateway/book-gateway-link";
import { resolveGatewayApiKeyById } from "@/lib/gateway/api-key-service";
import { getUserEcomBillingMode } from "@/lib/ecom/ecom-billing-mode";
import { assertPlatformGatewayEntitlement } from "@/lib/platform-gateway-entitlement";
import { ECOM_TOOLKIT_NAV_KEY } from "@/lib/ecom/ecom-access";

export function getEcomPlatformGatewayApiKeyId(): string | null {
  const id = process.env.ECOM_PLATFORM_GATEWAY_API_KEY_ID?.trim();
  return id && id.length > 0 ? id : null;
}

export function assertEcomPlatformGatewayConfigured(): void {
  if (!getEcomPlatformGatewayApiKeyId()) {
    throw new GatewayRequiredError(
      "平台代付未配置：请在 book-mall 环境变量设置 ECOM_PLATFORM_GATEWAY_API_KEY_ID（PLATFORM 范围 sk-gw）",
      "GATEWAY_KEY_REQUIRED",
      503,
    );
  }
}

/** 电商工具箱 Gateway 调用前准入 */
export async function assertEcomToolkitGatewayAccess(userId: string): Promise<void> {
  const mode = await getUserEcomBillingMode(userId);
  if (mode === "PLATFORM_METERED") {
    assertEcomPlatformGatewayConfigured();
    return;
  }
  await assertPlatformGatewayEntitlement(userId, {
    navKey: ECOM_TOOLKIT_NAV_KEY,
  });
  await assertGatewayApiKeyLinkedForUser(userId);
}

export async function resolveEcomGatewayAuthForUser(userId: string) {
  const mode = await getUserEcomBillingMode(userId);
  if (mode === "PLATFORM_METERED") {
    const keyId = getEcomPlatformGatewayApiKeyId();
    if (!keyId) return null;
    return resolveGatewayApiKeyById(keyId);
  }
  return resolveGatewayAuthForBookUser(userId);
}
