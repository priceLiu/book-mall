import { NextResponse } from "next/server";
import {
  gatewaySsoExchangeAuthorized,
  getGatewayJwtTtlSec,
  requireGatewayJwtSecret,
} from "@/lib/gateway/env";
import { signGatewayAccessToken } from "@/lib/gateway/gateway-sso-token";
import {
  findGatewayUserByBookUserId,
  syncGatewayUserFromBookUser,
} from "@/lib/gateway/sync-user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!gatewaySsoExchangeAuthorized(req)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  let code = "";
  try {
    const body = await req.json();
    if (typeof body?.code === "string") code = body.code.trim();
  } catch {
    return NextResponse.json({ error: "无效请求" }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: "缺少 code" }, { status: 400 });
  }

  const row = await prisma.ssoAuthorizationCode.findUnique({ where: { code } });
  const now = new Date();
  if (!row || row.consumedAt || row.expiresAt < now) {
    return NextResponse.json({ error: "无效或过期 code" }, { status: 400 });
  }

  const bookUser = await prisma.user.findUnique({ where: { id: row.userId } });
  if (!bookUser?.email) {
    return NextResponse.json({ error: "Book 用户不存在" }, { status: 400 });
  }

  await prisma.ssoAuthorizationCode.update({
    where: { id: row.id },
    data: { consumedAt: now },
  });

  let gwUser = await findGatewayUserByBookUserId(bookUser.id);
  if (!gwUser) {
    gwUser = await syncGatewayUserFromBookUser({
      bookUserId: bookUser.id,
      email: bookUser.email,
      name: bookUser.name,
      image: bookUser.image,
    });
  }
  if (!gwUser) {
    return NextResponse.json({ error: "Gateway 用户同步失败" }, { status: 500 });
  }

  const secret = requireGatewayJwtSecret();
  const expiresIn = getGatewayJwtTtlSec();
  const accessToken = signGatewayAccessToken({
    gatewayUserId: gwUser.id,
    secret,
    expiresInSec: expiresIn,
    profile: {
      email: gwUser.email,
      name: gwUser.name,
      image: gwUser.image,
    },
  });

  return NextResponse.json({
    access_token: accessToken,
    expires_in: expiresIn,
    token_type: "Bearer",
    gateway_user_id: gwUser.id,
  });
}
