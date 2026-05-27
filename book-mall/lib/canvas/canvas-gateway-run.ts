/**
 * Canvas 运行须经 Gateway 代理（断直连；禁止用户自建 Provider）
 */

import {
  assertGatewayApiKeyLinkedForUser,
  getGatewayLinkStatusForUser,
} from "@/lib/gateway/book-gateway-link";
import { CanvasProjectError } from "./canvas-project-service";
import { isGatewayVirtualProviderId } from "./canvas-gateway-providers";
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

/** system:* → gateway:* 映射（节点仍可能存 legacy id） */
export function canvasProviderIdForGateway(providerId: string): string {
  if (isGatewayVirtualProviderId(providerId)) return providerId;
  if (providerId === "system:kie") return "gateway:kie";
  if (providerId === "system:deepseek") return "gateway:deepseek";
  if (providerId === "system:bailian-r2v") return "gateway:bailian";
  if (providerId === "system:hunyuan-3d") return "gateway:hunyuan";
  return providerId;
}
