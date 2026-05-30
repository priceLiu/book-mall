/**
 * 平台壳模式：模型经同域 BFF → Book Gateway，禁止浏览器直连厂商、禁止自填 Key。
 */
import { getEnvVar } from "./environment";

export const PLATFORM_GATEWAY_PROVIDER_ID = "platform-gateway";

export function isPlatformGatewayMode(): boolean {
  const v = getEnvVar("VITE_PLATFORM_GATEWAY").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function getPlatformGatewayChatPath(): string {
  return "/api/gateway/chat";
}

export function getPlatformGatewayClientPage(): string {
  return "prompt-optimizer";
}
