import type { BillingPersona } from "@prisma/client";
import { isAccountCanvasLaunchClickable } from "@/lib/account-canvas-launch-clickable";

/** 侧栏「应用」分组未出现时的说明（便于用户自查） */

export function buildAccountAppsMenuHint(input: {
  toolsSsoReady: boolean;
  hasToolService: boolean;
  gatewayLinked: boolean;
  canvasOriginConfigured: boolean;
  canLaunchCanvas: boolean;
  ecomAccess: boolean;
  ecomOriginConfigured: boolean;
  quickReplicaOriginConfigured: boolean;
  canLaunchQuickReplica: boolean;
  isAdmin: boolean;
  billingPersona: BillingPersona | null;
}): string | null {
  const canLaunchTools =
    input.toolsSsoReady && (input.isAdmin || input.hasToolService);
  const canvasReady = isAccountCanvasLaunchClickable({
    canLaunchCanvas: input.canLaunchCanvas,
    canvasOriginConfigured: input.canvasOriginConfigured,
    billingPersona: input.billingPersona,
    gatewayLinked: input.gatewayLinked,
  });
  const canvasVisible =
    input.canLaunchCanvas && input.canvasOriginConfigured;
  const ecomReady =
    input.toolsSsoReady &&
    (input.isAdmin || input.ecomAccess) &&
    input.ecomOriginConfigured;
  const quickReplicaReady = isAccountCanvasLaunchClickable({
    canLaunchCanvas: input.canLaunchQuickReplica,
    canvasOriginConfigured: input.quickReplicaOriginConfigured,
    billingPersona: input.billingPersona,
    gatewayLinked: input.gatewayLinked,
  });

  if (canLaunchTools || canvasReady || ecomReady || quickReplicaReady) {
    if (canvasVisible && !canvasReady && input.billingPersona === "BYOK") {
      return "AI 画布需先在「Gateway API Key」完成 sk-gw 关联。";
    }
    return null;
  }

  if (!input.toolsSsoReady) {
    return process.env.NODE_ENV === "development"
      ? "应用未显示：主站未配置工具站 SSO（TOOLS_PUBLIC_ORIGIN、TOOLS_SSO_*）。"
      : "应用入口暂不可用，请联系管理员检查工具站配置。";
  }

  if (!input.isAdmin && !input.hasToolService) {
    return "应用未显示：请在「工具技术服务费」开通至少一项有效月费。课程订阅不代替工具月费。";
  }

  if (!input.gatewayLinked && canLaunchTools) {
    return input.billingPersona === "BYOK"
      ? "AI 画布需先在「Gateway API Key」完成 sk-gw 关联后才会出现在侧栏。"
      : "AI 画布 Gateway 关联未完成，请稍后重试或联系团队管理员。";
  }

  if (!input.canvasOriginConfigured || !input.ecomOriginConfigured || !input.quickReplicaOriginConfigured) {
    return process.env.NODE_ENV === "development"
      ? "应用未显示：检查 CANVAS_WEB_ORIGIN / ECOMMERCE_PUBLIC_ORIGIN / QUICK_REPLICA_PUBLIC_ORIGIN 环境变量。"
      : null;
  }

  if (!input.isAdmin && !input.ecomAccess && input.hasToolService) {
    return "电商工具箱需单独开通「e-commerce-toolkit」工具月费（或其它已开通分组不含电商时）。";
  }

  return null;
}
