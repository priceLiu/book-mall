import { getSessionVersion } from "@/lib/auth-session-version";
import {
  mergeEcomToolkitNavKeys,
  userCanAccessEcommerceToolkit,
} from "@/lib/ecom/ecom-access";
import { getUserEcomBillingMode } from "@/lib/ecom/ecom-billing-mode";
import { getToolsJwtTtlSec, requireToolsJwtSecret } from "@/lib/sso-tools-env";
import { getToolsSsoEligibility } from "@/lib/tools-sso-access";
import { signToolsAccessToken } from "@/lib/tools-sso-token";
import { resolveToolsNavKeysForUser } from "@/lib/tool-subscription-entitlements";
import { TOOL_SUITE_NAV_KEYS } from "@/lib/tool-suite-nav-keys";
import { resolveTenantContextForUser } from "@/lib/tenant/context";

export type IssueToolsAccessTokenResult =
  | {
      ok: true;
      accessToken: string;
      expiresIn: number;
      tokenSubtype: "tools_sso_admin" | "tools_sso_gold" | "tools_sso_member";
    }
  | { ok: false; status: number; error: string; code?: string };

/**
 * 为已登录用户签发 tools JWT（exchange / refresh-token / 门户登录共用）。
 *
 * 准入解耦：已登录但未开通工具月费者签发 `member` 令牌（`tools_nav_keys` 可空），
 * 可进门户浏览个人中心/定价/开通引导；生成能力仍由网关按 entitlement 复查。
 */
export async function issueToolsAccessTokenForUser(
  userId: string,
): Promise<IssueToolsAccessTokenResult> {
  const elig = await getToolsSsoEligibility(userId);
  const ecomOk = await userCanAccessEcommerceToolkit(userId);
  const entitled = elig.ok || ecomOk;

  const resolvedNav = await resolveToolsNavKeysForUser(userId);
  let toolsNavKeys = elig.isAdmin ? [...TOOL_SUITE_NAV_KEYS] : resolvedNav.keys;
  toolsNavKeys = await mergeEcomToolkitNavKeys(
    userId,
    toolsNavKeys,
    elig.isAdmin,
  );

  const tier: "admin" | "gold" | "member" = elig.isAdmin
    ? "admin"
    : entitled
      ? "gold"
      : "member";

  let jwtSecret: string;
  try {
    jwtSecret = requireToolsJwtSecret();
  } catch {
    return { ok: false, status: 503, error: "JWT 密钥未配置" };
  }

  const expiresIn = getToolsJwtTtlSec();
  const ecomBillingMode = await getUserEcomBillingMode(userId);
  const tenantCtx = await resolveTenantContextForUser(userId);
  const sessionVersion = await getSessionVersion(userId);
  const accessToken = signToolsAccessToken({
    userId,
    secret: jwtSecret,
    expiresInSec: expiresIn,
    tier,
    toolsNavKeys,
    ecomBillingMode,
    sessionVersion,
    tenant: tenantCtx
      ? {
          tenantId: tenantCtx.tenantId,
          tenantType: tenantCtx.tenantType,
          roleType: tenantCtx.role,
          seatId: tenantCtx.seatId,
        }
      : undefined,
    profile: {
      email: elig.email,
      phone: elig.phone,
      name: elig.name,
      image: elig.image,
    },
  });

  return {
    ok: true,
    accessToken,
    expiresIn,
    tokenSubtype:
      tier === "admin"
        ? "tools_sso_admin"
        : tier === "gold"
          ? "tools_sso_gold"
          : "tools_sso_member",
  };
}
