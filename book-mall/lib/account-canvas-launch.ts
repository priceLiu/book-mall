import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { getGatewayLinkStatusForUser } from "@/lib/gateway/book-gateway-link";
import { getCanvasWebOrigin } from "@/lib/app-web-origins";

export { isAccountCanvasLaunchClickable } from "@/lib/account-canvas-launch-clickable";
export type { AccountCanvasLaunchPersona } from "@/lib/account-canvas-launch-clickable";

/**
 * 个人中心侧栏「AI 画布」状态（只读，不在 layout 内自动签发 sk-gw，避免拖慢整页）。
 * 实际打开画布时由 canvas-open / assertGateway 路径 ensure。
 */
export async function prepareAccountCanvasLaunch(userId: string): Promise<{
  gatewayLinked: boolean;
  canvasOriginConfigured: boolean;
}> {
  const persona = await getUserBillingPersona(userId);
  const [gatewayStatus, canvasOriginConfigured] = await Promise.all([
    getGatewayLinkStatusForUser(userId),
    Promise.resolve(Boolean(getCanvasWebOrigin().startsWith("http"))),
  ]);

  const gatewayLinked =
    persona === "PLATFORM_CREDIT" ? true : gatewayStatus.linked;

  return {
    gatewayLinked,
    canvasOriginConfigured,
  };
}
