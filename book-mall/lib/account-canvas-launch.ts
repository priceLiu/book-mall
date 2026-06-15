import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { getGatewayLinkStatusForUser } from "@/lib/gateway/book-gateway-link";
import { ensurePlatformManagedKeyForUser } from "@/lib/gateway/platform-managed-key";
import { getCanvasWebOrigin } from "@/lib/app-web-origins";

export { isAccountCanvasLaunchClickable } from "@/lib/account-canvas-launch-clickable";
export type { AccountCanvasLaunchPersona } from "@/lib/account-canvas-launch-clickable";

/**
 * 个人中心侧栏「AI 画布」：PLATFORM_CREDIT 用户自动托管 sk-gw（含团队成员）。
 */
export async function prepareAccountCanvasLaunch(userId: string): Promise<{
  gatewayLinked: boolean;
  canvasOriginConfigured: boolean;
}> {
  const persona = await getUserBillingPersona(userId);
  if (persona === "PLATFORM_CREDIT") {
    try {
      await ensurePlatformManagedKeyForUser(userId);
    } catch {
      /* 仍读 link 状态供 UI 提示 */
    }
  }

  const [gatewayStatus, canvasOriginConfigured] = await Promise.all([
    getGatewayLinkStatusForUser(userId),
    Promise.resolve(Boolean(getCanvasWebOrigin().startsWith("http"))),
  ]);

  return {
    gatewayLinked: gatewayStatus.linked,
    canvasOriginConfigured,
  };
}
