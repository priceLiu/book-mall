import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGoldMemberAccess } from "@/lib/gold-member";
import {
  getToolsJwtTtlSec,
  requireToolsJwtSecret,
  toolsExchangeAuthorized,
} from "@/lib/sso-tools-env";
import { signToolsAccessToken } from "@/lib/tools-sso-token";

/**
 * 工具站服务端调用：用一次性 code 换短时 access token（JWT）。
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

  const gold = await getGoldMemberAccess(row.userId);
  if (!gold.isGoldMember) {
    await prisma.ssoAuthorizationCode.update({
      where: { id: row.id },
      data: { consumedAt: now },
    });
    return NextResponse.json(
      { error: "当前不满足黄金会员条件，授权码已作废" },
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
  });

  return NextResponse.json({
    access_token: accessToken,
    expires_in: expiresIn,
    token_type: "Bearer",
    token_subtype: "tools_sso_gold",
  });
}
