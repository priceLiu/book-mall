import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionVersion } from "@/lib/auth-session-version";
import { issueToolsAccessTokenForUser } from "@/lib/issue-tools-access-token-for-user";
import {
  requireToolsJwtSecret,
  toolsExchangeAuthorized,
} from "@/lib/sso-tools-env";
import {
  verifyToolsAccessToken,
  verifyToolsAccessTokenAllowExpired,
} from "@/lib/tools-sso-token";

export const dynamic = "force-dynamic";

function tokenResponse(result: Awaited<ReturnType<typeof issueToolsAccessTokenForUser>>) {
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.code ? { code: result.code } : {}) },
      { status: result.status },
    );
  }
  return NextResponse.json({
    access_token: result.accessToken,
    expires_in: result.expiresIn,
    token_type: "Bearer",
    token_subtype: result.tokenSubtype,
  });
}

/**
 * POST：静默续签 tools JWT（无需浏览器跳转 re-enter）
 *
 * 1. 主站 NextAuth 会话（Cookie）→ 直接签发
 * 2. Authorization: Bearer {TOOLS_SSO_SERVER_SECRET} + body.userId → 子站 BFF 代刷
 * 3. Authorization: Bearer {未过期 tools JWT} → 续签
 * 4. Authorization: Bearer {已过期但签名有效 tools JWT} → 校验 sessionVersion 后续签
 */
export async function POST(req: NextRequest) {
  if (toolsExchangeAuthorized(req)) {
    let userId = "";
    try {
      const body = (await req.json()) as { userId?: unknown };
      if (typeof body?.userId === "string") userId = body.userId.trim();
    } catch {
      return NextResponse.json({ error: "无效请求体" }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: "缺少 userId" }, { status: 400 });
    }
    return tokenResponse(await issueToolsAccessTokenForUser(userId));
  }

  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    return tokenResponse(await issueToolsAccessTokenForUser(session.user.id));
  }

  const auth = req.headers.get("authorization");
  const raw =
    auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!raw) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let jwtSecret: string;
  try {
    jwtSecret = requireToolsJwtSecret();
  } catch {
    return NextResponse.json({ error: "JWT 密钥未配置" }, { status: 503 });
  }

  const active = verifyToolsAccessToken(raw, jwtSecret);
  if (active) {
    return tokenResponse(await issueToolsAccessTokenForUser(active.sub));
  }

  const expired = verifyToolsAccessTokenAllowExpired(raw, jwtSecret);
  if (!expired) {
    return NextResponse.json({ error: "无效或过期的工具令牌" }, { status: 401 });
  }

  if (typeof expired.sv === "number") {
    const currentSv = await getSessionVersion(expired.sub);
    if (currentSv !== expired.sv) {
      return NextResponse.json(
        { error: "会话已在别处登录，请重新连接主站账号", code: "SESSION_REVOKED" },
        { status: 401 },
      );
    }
  }

  return tokenResponse(await issueToolsAccessTokenForUser(expired.sub));
}
