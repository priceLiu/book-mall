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
      tokenSubtype: "tools_sso_admin" | "tools_sso_gold";
    }
  | { ok: false; status: number; error: string; code?: string };

/** 为已登录用户签发 tools JWT（exchange / refresh-token 共用） */
export async function issueToolsAccessTokenForUser(
  userId: string,
): Promise<IssueToolsAccessTokenResult> {
  const elig = await getToolsSsoEligibility(userId);
  const ecomOk = await userCanAccessEcommerceToolkit(userId);
  if (!elig.ok && !ecomOk) {
    return {
      ok: false,
      status: 403,
      error:
        "当前不满足工具站准入条件（须管理员，或至少一项有效工具技术服务费）",
      code: "TOOLS_ACCESS_DENIED",
    };
  }

  const resolvedNav = await resolveToolsNavKeysForUser(userId);
  let toolsNavKeys = elig.isAdmin ? [...TOOL_SUITE_NAV_KEYS] : resolvedNav.keys;
  toolsNavKeys = await mergeEcomToolkitNavKeys(
    userId,
    toolsNavKeys,
    elig.isAdmin,
  );

  if (!elig.isAdmin && toolsNavKeys.length === 0 && !ecomOk) {
    return {
      ok: false,
      status: 403,
      error:
        "当前未开通任何工具分组的技术服务费，请先在个人中心「工具技术服务费」页开通后再试",
      code: "TOOLS_ACCESS_DENIED",
    };
  }

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
    tier: elig.isAdmin ? "admin" : "gold",
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
    tokenSubtype: elig.isAdmin ? "tools_sso_admin" : "tools_sso_gold",
  };
}
