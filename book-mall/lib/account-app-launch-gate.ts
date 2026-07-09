import type { BillingPersona } from "@prisma/client";

/** 无会员/无准入时，应用入口点击跳转的选购页 */
export const ACCOUNT_APP_SUBSCRIBE_HREF = "/pricing";

export function resolveAppLaunchBlockedRedirect(input: {
  actionId: string;
  canLaunchTools: boolean;
  canLaunchCanvas: boolean;
  canvasOriginConfigured: boolean;
  canvasReady: boolean;
  ecomReady: boolean;
  canLaunchQuickReplica: boolean;
  quickReplicaOriginConfigured: boolean;
  quickReplicaReady: boolean;
  billingPersona: BillingPersona | null;
  gatewayLinked: boolean;
}): string | null {
  const { actionId } = input;

  if (actionId === "launch-tools") {
    return input.canLaunchTools ? null : ACCOUNT_APP_SUBSCRIBE_HREF;
  }

  if (actionId === "launch-canvas") {
    if (
      input.canLaunchCanvas &&
      input.canvasOriginConfigured &&
      input.billingPersona === "BYOK" &&
      !input.gatewayLinked
    ) {
      return "/account/gateway";
    }
    return input.canvasReady ? null : ACCOUNT_APP_SUBSCRIBE_HREF;
  }

  if (actionId === "launch-ecom") {
    return input.ecomReady ? null : ACCOUNT_APP_SUBSCRIBE_HREF;
  }

  if (actionId === "launch-quick-replica") {
    if (
      input.canLaunchQuickReplica &&
      input.quickReplicaOriginConfigured &&
      input.billingPersona === "BYOK" &&
      !input.gatewayLinked
    ) {
      return "/account/gateway";
    }
    return input.quickReplicaReady ? null : ACCOUNT_APP_SUBSCRIBE_HREF;
  }

  return null;
}

export function isAppLaunchAction(id: string): boolean {
  return (
    id === "launch-tools" ||
    id === "launch-canvas" ||
    id === "launch-ecom" ||
    id === "launch-quick-replica"
  );
}
