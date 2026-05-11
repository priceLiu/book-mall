import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGoldMemberAccess } from "@/lib/gold-member";
import {
  getSsoCodeTtlSec,
  getToolsPublicOrigin,
  requireToolsJwtSecret,
  requireToolsSsoServerSecret,
} from "@/lib/sso-tools-env";

/**
 * 主站侧：黄金会员换取跳转 URL（query 带一次性 code）。
 * 工具站 `/auth/sso/callback` 应用服务端 POST `/api/sso/tools/exchange` 换 token。
 */
export async function POST(req: Request) {
  try {
    requireToolsSsoServerSecret();
    requireToolsJwtSecret();
  } catch {
    return NextResponse.json(
      { error: "SSO 环境变量未正确配置（TOOLS_PUBLIC_ORIGIN / TOOLS_SSO_*）" },
      { status: 503 },
    );
  }

  const origin = getToolsPublicOrigin();
  if (!origin) {
    return NextResponse.json(
      { error: "TOOLS_PUBLIC_ORIGIN 无效或未配置" },
      { status: 503 },
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let redirectPath = "/";
  try {
    const body = await req.json();
    if (typeof body?.redirectPath === "string") {
      const rp = body.redirectPath.trim();
      if (rp.startsWith("/") && !rp.startsWith("//")) redirectPath = rp;
    }
  } catch {
    /* ignore body */
  }

  const gold = await getGoldMemberAccess(session.user.id);
  if (!gold.isGoldMember) {
    return NextResponse.json(
      {
        error:
          "需要黄金会员：请先完成钱包充值，且可用余额不低于平台最低线（默认 ¥20）",
        code: "NOT_GOLD_MEMBER",
      },
      { status: 403 },
    );
  }

  const code = randomBytes(24).toString("hex");
  const ttlSec = getSsoCodeTtlSec();
  await prisma.ssoAuthorizationCode.create({
    data: {
      code,
      userId: session.user.id,
      expiresAt: new Date(Date.now() + ttlSec * 1000),
    },
  });

  const redirectUrl = `${origin}/auth/sso/callback?code=${encodeURIComponent(code)}&redirect=${encodeURIComponent(redirectPath)}`;
  return NextResponse.json({ redirectUrl, codeTtlSeconds: ttlSec });
}
