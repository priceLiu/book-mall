import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getToolsSsoEligibility } from "@/lib/tools-sso-access";
import {
  getToolsJwtTtlSec,
  requireToolsJwtSecret,
  toolsExchangeAuthorized,
} from "@/lib/sso-tools-env";
import { signToolsAccessToken } from "@/lib/tools-sso-token";
import { TOOL_SUITE_NAV_KEYS } from "@/lib/tool-suite-nav-keys";
import { resolveToolsNavKeysForUser } from "@/lib/tool-subscription-entitlements";

export const dynamic = "force-dynamic";

/**
 * 工具站服务端调用：用一次性 code 换短时 access token（JWT）。
 * 准入：管理员直通；普通用户须为黄金会员且具备有效订阅。JWT `tier` 分别为 `gold` / `admin`，载荷含 `tools_nav_keys`。
 * 须在服务端发起；Bearer 为 TOOLS_SSO_SERVER_SECRET。
 */
export async function POST(req: Request) {
  if (!toolsExchangeAuthorized(req)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  let code = "";
  try {
    const body = await req.json();
    if (typeof body?.code === "string") code = body.code.trim();
  } catch {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: "缺少 code" }, { status: 400 });
  }

  const row = await prisma.ssoAuthorizationCode.findUnique({
    where: { code },
  });
  const now = new Date();
  if (!row || row.consumedAt || row.expiresAt < now) {
    return NextResponse.json({ error: "无效或已过期的授权码" }, { status: 400 });
  }

  const elig = await getToolsSsoEligibility(row.userId);
  if (!elig.ok) {
    await prisma.ssoAuthorizationCode.update({
      where: { id: row.id },
      data: { consumedAt: now },
    });
    return NextResponse.json(
      {
        error:
          "当前不满足工具站准入条件（须管理员，或黄金会员且具备会员计划或单品工具订阅），授权码已作废",
      },
      { status: 403 },
    );
  }

  const resolvedNav = await resolveToolsNavKeysForUser(row.userId);
  const toolsNavKeys = elig.isAdmin
    ? [...TOOL_SUITE_NAV_KEYS]
    : resolvedNav.keys;
  if (!elig.isAdmin && toolsNavKeys.length === 0) {
    await prisma.ssoAuthorizationCode.update({
      where: { id: row.id },
      data: { consumedAt: now },
    });
    return NextResponse.json(
      {
        error:
          "当前订阅未包含任何可用工具分组，请先在个人中心核对套件权益后再试",
      },
      { status: 403 },
    );
  }

  await prisma.ssoAuthorizationCode.update({
    where: { id: row.id },
    data: { consumedAt: now },
  });

  let jwtSecret: string;
  try {
    jwtSecret = requireToolsJwtSecret();
  } catch {
    return NextResponse.json({ error: "JWT 密钥未配置" }, { status: 503 });
  }

  const expiresIn = getToolsJwtTtlSec();
  const accessToken = signToolsAccessToken({
    userId: row.userId,
    secret: jwtSecret,
    expiresInSec: expiresIn,
    tier: elig.isAdmin ? "admin" : "gold",
    toolsNavKeys,
    profile: {
      email: elig.email,
      name: elig.name,
      image: elig.image,
    },
  });

  return NextResponse.json({
    access_token: accessToken,
    expires_in: expiresIn,
    token_type: "Bearer",
    token_subtype: elig.isAdmin ? "tools_sso_admin" : "tools_sso_gold",
  });
}
