import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getToolsSsoEligibility } from "@/lib/tools-sso-access";
import { toolsExchangeAuthorized } from "@/lib/sso-tools-env";
import { issueToolsAccessTokenForUser } from "@/lib/issue-tools-access-token-for-user";
import {
  mergeEcomToolkitNavKeys,
  userCanAccessEcommerceToolkit,
} from "@/lib/ecom/ecom-access";
import { resolveToolsNavKeysForUser } from "@/lib/tool-subscription-entitlements";
import { TOOL_SUITE_NAV_KEYS } from "@/lib/tool-suite-nav-keys";
import {
  intersectNavKeysWithSsoClient,
  loadActiveSsoClient,
} from "@/lib/sso-client-scope";

export const dynamic = "force-dynamic";

/**
 * 工具站服务端调用：用一次性 code 换短时 access token（JWT）。
 * 准入：管理员直通；普通用户须至少一个有效工具技术服务费周期。JWT `tier` 分别为 `gold` / `admin`（legacy 字段名），载荷含 `tools_nav_keys` 与 `tool_service_periods`。
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
  const ecomOk = await userCanAccessEcommerceToolkit(row.userId);
  if (!elig.ok && !ecomOk) {
    await prisma.ssoAuthorizationCode.update({
      where: { id: row.id },
      data: { consumedAt: now },
    });
    return NextResponse.json(
      {
        error:
          "当前不满足工具站准入条件（须管理员，或至少一项有效工具技术服务费），授权码已作废",
      },
      { status: 403 },
    );
  }

  const resolvedNav = await resolveToolsNavKeysForUser(row.userId);
  let toolsNavKeys = elig.isAdmin
    ? [...TOOL_SUITE_NAV_KEYS]
    : resolvedNav.keys;
  toolsNavKeys = await mergeEcomToolkitNavKeys(
    row.userId,
    toolsNavKeys,
    elig.isAdmin,
  );

  if (row.clientId?.trim()) {
    const client = await loadActiveSsoClient(row.clientId);
    if (!client) {
      await prisma.ssoAuthorizationCode.update({
        where: { id: row.id },
        data: { consumedAt: now },
      });
      return NextResponse.json(
        { error: "无效的 client_id 或客户端已停用", code: "SSO_CLIENT_INVALID" },
        { status: 403 },
      );
    }
    if (!elig.isAdmin) {
      toolsNavKeys = intersectNavKeysWithSsoClient(
        toolsNavKeys,
        client.allowedNavKeys,
      ) as typeof toolsNavKeys;
    }
  }

  if (!elig.isAdmin && toolsNavKeys.length === 0 && !ecomOk) {
    await prisma.ssoAuthorizationCode.update({
      where: { id: row.id },
      data: { consumedAt: now },
    });
    return NextResponse.json(
      {
        error:
          "当前未开通任何工具分组的技术服务费，请先在个人中心「工具技术服务费」页开通后再试",
      },
      { status: 403 },
    );
  }

  await prisma.ssoAuthorizationCode.update({
    where: { id: row.id },
    data: { consumedAt: now },
  });

  const issued = await issueToolsAccessTokenForUser(row.userId);
  if (!issued.ok) {
    return NextResponse.json(
      { error: issued.error, ...(issued.code ? { code: issued.code } : {}) },
      { status: issued.status },
    );
  }

  return NextResponse.json({
    access_token: issued.accessToken,
    expires_in: issued.expiresIn,
    token_type: "Bearer",
    token_subtype: issued.tokenSubtype,
  });
}
