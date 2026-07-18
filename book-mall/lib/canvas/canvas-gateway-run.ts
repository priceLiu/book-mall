/**
 * Canvas 运行须经 Gateway 代理（断直连；禁止用户自建 Provider）
 */

import {
  assertGatewayApiKeyLinkedForUser,
  getGatewayLinkStatusForUser,
} from "@/lib/gateway/book-gateway-link";
import {
  assertPlatformGatewayEntitlement,
  PlatformEntitlementError,
} from "@/lib/platform-gateway-entitlement";
import type { GatewayProviderKind } from "@prisma/client";

import { routeGatewayModel } from "@/lib/gateway/model-router";
import { CanvasProjectError } from "./canvas-project-service";
import {
  GATEWAY_BAILIAN_PROVIDER_ID,
  GATEWAY_DEEPSEEK_PROVIDER_ID,
  GATEWAY_MOONSHOT_PROVIDER_ID,
  GATEWAY_HUNYUAN_PROVIDER_ID,
  GATEWAY_KIE_PROVIDER_ID,
  GATEWAY_TOPAZ_PROVIDER_ID,
  GATEWAY_VOLCENGINE_PROVIDER_ID,
  isGatewayVirtualProviderId,
} from "./canvas-gateway-providers";
import { isSystemProviderId } from "./canvas-system-provider";

/** 仅允许 gateway:* 与 system:*（运行时会走 Gateway） */
export function assertCanvasProviderGatewayOnly(providerId: string): void {
  if (!providerId.trim()) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      "缺少 providerId，请在节点中选择 Gateway Provider",
      400,
    );
  }
  if (isGatewayVirtualProviderId(providerId) || isSystemProviderId(providerId)) {
    return;
  }
  throw new CanvasProjectError(
    "GATEWAY_KEY_REQUIRED",
    "Canvas 自建 Provider 已下线，请使用 Gateway Provider（Gateway 控制台绑凭证 + Book 个人中心关联 sk-gw）",
    403,
  );
}

/** 所有允许的 Provider 均经 Gateway；须已关联 sk-gw */
export async function shouldCanvasUseGateway(
  userId: string,
  providerId: string,
  _modelKey?: string,
): Promise<boolean> {
  assertCanvasProviderGatewayOnly(providerId);
  try {
    await assertPlatformGatewayEntitlement(userId, { navKey: "ai-poster-canvas" });
  } catch (e) {
    if (e instanceof PlatformEntitlementError) {
      throw new CanvasProjectError("FORBIDDEN", e.message, e.httpStatus);
    }
    throw e;
  }
  const link = await getGatewayLinkStatusForUser(userId);
  if (!link.linked) {
    throw new CanvasProjectError(
      "GATEWAY_KEY_REQUIRED",
      "请先在 Gateway 控制台绑定厂商凭证，并在 Book 个人中心关联 sk-gw",
      403,
    );
  }
  return true;
}

const GATEWAY_ID_BY_PROVIDER_KIND: Partial<
  Record<GatewayProviderKind, string>
> = {
  KIE: GATEWAY_KIE_PROVIDER_ID,
  DEEPSEEK: GATEWAY_DEEPSEEK_PROVIDER_ID,
  MOONSHOT: GATEWAY_MOONSHOT_PROVIDER_ID,
  BAILIAN: GATEWAY_BAILIAN_PROVIDER_ID,
  HUNYUAN: GATEWAY_HUNYUAN_PROVIDER_ID,
  VOLCENGINE: GATEWAY_VOLCENGINE_PROVIDER_ID,
  TOPAZ: GATEWAY_TOPAZ_PROVIDER_ID,
};

/** 节点 providerId 须与 modelKey 路由一致（Gateway 实际按 modelKey 选凭证） */
export function assertCanvasProviderMatchesModelRoute(
  providerId: string,
  modelKey: string,
): void {
  const normalized = canvasProviderIdForGateway(providerId);
  const route = routeGatewayModel(modelKey);
  const expected = GATEWAY_ID_BY_PROVIDER_KIND[route.providerKind];
  if (!expected || normalized === expected) return;
  throw new CanvasProjectError(
    "INVALID_INPUT",
    `所选模型 ${modelKey} 会走 ${route.providerKind}（${expected}），与节点 Provider（${normalized}）不一致。请重新打开模型选择器确认后再生成。`,
    400,
  );
}

/** system:* → gateway:* 映射（节点仍可能存 legacy id） */
export function canvasProviderIdForGateway(providerId: string): string {
  if (isGatewayVirtualProviderId(providerId)) return providerId;
  if (providerId === "system:kie") return "gateway:kie";
  if (providerId === "system:deepseek") return "gateway:deepseek";
  if (providerId === "system:moonshot") return "gateway:moonshot";
  if (providerId === "system:bailian-r2v") return "gateway:bailian";
  if (providerId === "system:hunyuan-3d") return "gateway:hunyuan";
  return providerId;
}
