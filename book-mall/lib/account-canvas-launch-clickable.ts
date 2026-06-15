/** 纯函数：客户端 / 服务端均可 import，勿引入 Prisma 或 Gateway。 */

export type AccountCanvasLaunchPersona = "BYOK" | "PLATFORM_CREDIT" | null;

/** 侧栏 / 概览「打开画布」是否可点（平台代付不强制先 linked） */
export function isAccountCanvasLaunchClickable(input: {
  canLaunchCanvas: boolean;
  canvasOriginConfigured: boolean;
  billingPersona: AccountCanvasLaunchPersona;
  gatewayLinked: boolean;
}): boolean {
  if (!input.canLaunchCanvas || !input.canvasOriginConfigured) return false;
  if (input.billingPersona === "PLATFORM_CREDIT") return true;
  return input.gatewayLinked;
}
