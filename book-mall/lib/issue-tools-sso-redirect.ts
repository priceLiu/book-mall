import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getToolsSsoEligibility } from "@/lib/tools-sso-access";
import {
  getSsoCodeTtlSec,
  getToolsPublicOrigin,
  requireToolsJwtSecret,
  requireToolsSsoServerSecret,
} from "@/lib/sso-tools-env";
import { sanitizeToolsRedirectPath } from "@/lib/sanitize-tools-redirect-path";

export type IssueToolsSsoResult =
  | { ok: true; redirectUrl: string; codeTtlSeconds: number }
  | {
      ok: false;
      status: number;
      error: string;
      code?: string;
    };

/** 与 POST /api/sso/tools/issue 共用：签发一次性 code 并得到工具站 callback URL */
export async function issueToolsSsoRedirect(opts: {
  userId: string;
  redirectPath?: string;
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

  const toolsOrigin = getToolsPublicOrigin();
  if (!toolsOrigin) {
    return {
      ok: false,
      status: 503,
      error: "TOOLS_PUBLIC_ORIGIN 无效或未配置",
      code: "TOOLS_PUBLIC_ORIGIN_INVALID",
    };
  }

  const redirectPath = sanitizeToolsRedirectPath(opts.redirectPath);

  const elig = await getToolsSsoEligibility(opts.userId);
  if (!elig.ok) {
    return {
      ok: false,
      status: 403,
      error:
        "需要黄金会员（充值记录 + 余额不低于最低线）以及有效的会员计划或单品工具订阅；当前不满足工具站准入条件",
      code: "TOOLS_ACCESS_DENIED",
    };
  }

  const code = randomBytes(24).toString("hex");
  const ttlSec = getSsoCodeTtlSec();
  try {
    await prisma.ssoAuthorizationCode.create({
      data: {
        code,
        userId: opts.userId,
        expiresAt: new Date(Date.now() + ttlSec * 1000),
      },
    });
  } catch (e) {
    console.error("[issueToolsSsoRedirect] prisma.ssoAuthorizationCode.create", e);
    return {
      ok: false,
      status: 500,
      error:
        "写入授权码失败：数据库可能尚未包含 SsoAuthorizationCode 表。请在 book-mall 目录执行 dotenv -e .env.local -- prisma migrate deploy 后重启 dev。",
      code: "SSO_CODE_PERSIST_FAILED",
    };
  }

  const redirectUrl = `${toolsOrigin}/auth/sso/callback?code=${encodeURIComponent(code)}&redirect=${encodeURIComponent(redirectPath)}`;
  return { ok: true, redirectUrl, codeTtlSeconds: ttlSec };
}
