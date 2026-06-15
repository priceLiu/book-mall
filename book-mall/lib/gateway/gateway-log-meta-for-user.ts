import type { GatewayClientSource } from "@prisma/client";

import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { resolveTenantContextForUser } from "@/lib/tenant/context";
import { gatewayV1ClientMeta } from "@/lib/gateway/gateway-v1-http-client";
import type { GatewayV1LogMeta } from "@/lib/gateway/gateway-v1-log-meta";

export type GatewayV1ClientMetaExtra = Omit<
  GatewayV1LogMeta,
  "clientSource" | "actorBookUserId" | "tenantId" | "seatId" | "billingPersonaSnap"
> & {
  /** 画布/故事项目归属 TEAM 租户 id（优先于用户默认空间） */
  preferredTenantId?: string | null;
};

/** Canvas / Story / 工具站服务端调 Gateway 时附带团队计费上下文 */
export async function gatewayV1ClientMetaForBookUser(
  clientSource: GatewayClientSource,
  bookUserId: string,
  extra?: GatewayV1ClientMetaExtra,
): Promise<GatewayV1LogMeta> {
  const preferredTenantId = extra?.preferredTenantId?.trim() || undefined;
  const [tenantCtx, persona] = await Promise.all([
    resolveTenantContextForUser(bookUserId, preferredTenantId),
    getUserBillingPersona(bookUserId),
  ]);
  const { preferredTenantId: _drop, ...restExtra } = extra ?? {};
  return gatewayV1ClientMeta(clientSource, {
    ...restExtra,
    bookUserId,
    tenantId: tenantCtx?.tenantType === "TEAM" ? tenantCtx.tenantId : undefined,
    seatId: tenantCtx?.seatId ?? undefined,
    billingPersonaSnap: persona ?? undefined,
  });
}
