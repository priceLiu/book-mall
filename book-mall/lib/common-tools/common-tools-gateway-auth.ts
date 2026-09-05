import {
  assertGatewayApiKeyLinkedForUser,
} from "@/lib/gateway/book-gateway-link";
import { assertPlatformGatewayEntitlement } from "@/lib/platform-gateway-entitlement";

/** 常用工具 Gateway 调用前准入（统一积分，不强制 suite 月费） */
export async function assertCommonToolsGatewayAccess(userId: string): Promise<void> {
  await assertPlatformGatewayEntitlement(userId, {
    navKey: "common-tools",
  });
  await assertGatewayApiKeyLinkedForUser(userId);
}
