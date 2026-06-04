import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getToolsSsoEligibility } from "@/lib/tools-sso-access";
import {
  getPlatformAppPublicOrigin,
  type PlatformSsoApp,
} from "@/lib/platform-app-sso";
import {
  getSsoCodeTtlSec,
  getToolsPublicOrigin,
  requireToolsJwtSecret,
  requireToolsSsoServerSecret,
} from "@/lib/sso-tools-env";
import { sanitizeToolsRedirectPath } from "@/lib/sanitize-tools-redirect-path";
import { userCanAccessEcommerceToolkit } from "@/lib/ecom/ecom-access";
import { resolveToolsNavKeysForUser } from "@/lib/tool-subscription-entitlements";
import {
  loadActiveSsoClient,
  userNavKeysOverlapSsoClient,
} from "@/lib/sso-client-scope";

export type IssueToolsSsoResult =
  | { ok: true; redirectUrl: string; codeTtlSeconds: number }
  | {
      ok: false;
      status: number;
      error: string;
      code?: string;
    };

function redirectMatchesRegisteredUri(redirectUri: string, allowed: string[]): boolean {
  try {
    const u = new URL(redirectUri);
    const normalized = `${u.origin}${u.pathname}`.replace(/\/$/, "") || u.origin;
    return allowed.some((a) => {
      try {
        const r = new URL(a.trim());
        const reg = `${r.origin}${r.pathname}`.replace(/\/$/, "") || r.origin;
        return reg === normalized;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/** 与 POST /api/sso/tools/issue 共用：签发一次性 code 并得到子应用 callback URL */
export async function issueToolsSsoRedirect(opts: {
  userId: string;
  redirectPath?: string;
  /** 内置子应用：tool / canvas / story / prompt-optimizer */
  app?: PlatformSsoApp;
  /** Phase F：注册第三方 client；redirectUri 须在其 redirectUris 白名单内 */
  clientId?: string;
  redirectUri?: string;
}): Promise<IssueToolsSsoResult> {
  try {
    requireToolsSsoServerSecret();
    requireToolsJwtSecret();
  } catch {
    return {
      ok: false,
      status: 503,
      error: "SSO 环境变量未正确配置（TOOLS_PUBLIC_ORIGIN / TOOLS_SSO_*）",
      code: "TOOLS_SSO_SECRETS_MISSING",
    };
  }

  const redirectPath = sanitizeToolsRedirectPath(opts.redirectPath);
  const app = opts.app ?? "tool";

  let callbackBase: string | null = null;
  let ssoClientAllowedNavKeys: string[] = [];

  if (opts.clientId?.trim()) {
    const client = await loadActiveSsoClient(opts.clientId);
    if (!client) {
      return {
        ok: false,
        status: 403,
        error: "无效的 client_id 或客户端已停用",
        code: "SSO_CLIENT_INVALID",
      };
    }
    const uri = opts.redirectUri?.trim();
    if (!uri || !redirectMatchesRegisteredUri(uri, client.redirectUris)) {
      return {
        ok: false,
        status: 400,
        error: "redirect_uri 不在该 client 注册的白名单内",
        code: "SSO_REDIRECT_URI_INVALID",
      };
    }
    callbackBase = uri.split("?")[0] ?? uri;
    ssoClientAllowedNavKeys = client.allowedNavKeys;
  } else {
    callbackBase = `${getPlatformAppPublicOrigin(app) ?? getToolsPublicOrigin()}/auth/sso/callback`;
    if (!callbackBase.startsWith("http")) {
      return {
        ok: false,
        status: 503,
        error: "子应用公网 Origin 未配置（TOOLS_PUBLIC_ORIGIN / NEXT_PUBLIC_*_WEB_ORIGIN）",
        code: "TOOLS_PUBLIC_ORIGIN_INVALID",
      };
    }
  }

  const elig = await getToolsSsoEligibility(opts.userId);
  const ecomApp = app === "e-commerce";
  const ecomOk = ecomApp ? await userCanAccessEcommerceToolkit(opts.userId) : false;
  if (ecomApp) {
    if (!elig.isAdmin && !ecomOk) {
      return {
        ok: false,
        status: 403,
        error:
          "当前无法使用电商工具箱：请开通「电商工具箱」月费，或在个人中心切换为「代付按次」模式并保证钱包余额充足",
        code: "TOOLS_ACCESS_DENIED",
      };
    }
  } else if (!elig.ok) {
    return {
      ok: false,
      status: 403,
      error:
        "当前不满足工具站准入条件（须管理员，或至少一项有效工具技术服务费）",
      code: "TOOLS_ACCESS_DENIED",
    };
  }

  if (opts.clientId?.trim() && !elig.isAdmin && ssoClientAllowedNavKeys.length > 0) {
    const resolved = await resolveToolsNavKeysForUser(opts.userId);
    if (!userNavKeysOverlapSsoClient(resolved.keys, ssoClientAllowedNavKeys)) {
      return {
        ok: false,
        status: 403,
        error: "当前账户的工具技术服务费不包含该第三方客户端所需的分组",
        code: "SSO_CLIENT_NAV_DENIED",
      };
    }
  }

  const code = randomBytes(24).toString("hex");
  const ttlSec = getSsoCodeTtlSec();
  try {
    await prisma.ssoAuthorizationCode.create({
      data: {
        code,
        userId: opts.userId,
        expiresAt: new Date(Date.now() + ttlSec * 1000),
        ...(opts.clientId?.trim() ? { clientId: opts.clientId.trim() } : {}),
      },
    });
  } catch (e) {
    console.error("[issueToolsSsoRedirect] prisma.ssoAuthorizationCode.create", e);
    return {
      ok: false,
      status: 500,
      error:
        "写入授权码失败：数据库可能尚未包含 SsoAuthorizationCode 表。请在 book-mall 目录执行 pnpm run db:deploy 后重启。",
      code: "SSO_CODE_PERSIST_FAILED",
    };
  }

  const q = new URLSearchParams({
    code,
    redirect: redirectPath,
  });
  const redirectUrl = `${callbackBase}?${q}`;
  return { ok: true, redirectUrl, codeTtlSeconds: ttlSec };
}
