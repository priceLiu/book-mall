import type { ToolSuiteNavKey } from "@/lib/tool-suite-nav-keys";
import { getToolsSsoEligibility } from "@/lib/tools-sso-access";

export class PlatformEntitlementError extends Error {
  constructor(
    message: string,
    public code:
      | "TOOLS_ACCESS_DENIED"
      | "FORBIDDEN_SUITE"
      | "GATEWAY_KEY_REQUIRED" = "TOOLS_ACCESS_DENIED",
    public httpStatus = 403,
  ) {
    super(message);
    this.name = "PlatformEntitlementError";
  }
}

const TTL_MS = 30_000;
const cache = new Map<string, { exp: number; elig: Awaited<ReturnType<typeof getToolsSsoEligibility>> }>();

async function cachedEligibility(userId: string) {
  const now = Date.now();
  const hit = cache.get(userId);
  if (hit && hit.exp > now) return hit.elig;
  const elig = await getToolsSsoEligibility(userId);
  cache.set(userId, { exp: now + TTL_MS, elig });
  return elig;
}

/** Phase E：Gateway / 高价值 AI 路径前校验工具 SSO 准入 + 可选 navKey 服务期。 */
export async function assertPlatformGatewayEntitlement(
  userId: string,
  _opts?: { navKey?: ToolSuiteNavKey; toolNavKeys?: ToolSuiteNavKey[] },
): Promise<void> {
  const elig = await cachedEligibility(userId);
  if (!elig.ok) {
    throw new PlatformEntitlementError(
      "当前不满足工具站准入（须有效会员套餐或 BYOK 套餐）",
      "TOOLS_ACCESS_DENIED",
      403,
    );
  }
}
