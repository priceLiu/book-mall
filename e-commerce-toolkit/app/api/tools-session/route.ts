import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { fetchEcomToolsSessionWithIntrospect } from "@/lib/ecom-tools-introspect";
import { readJwtExpSec, isToolsJwtExpired } from "@/lib/tools-jwt-exp";
import { getMainSiteOrigin } from "@/lib/site-origin";
import {
  isToolsFederatedLogoutRequest,
  respondToolsFederatedLogout,
} from "@/lib/tools-federated-logout";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (isToolsFederatedLogoutRequest(request)) {
    return respondToolsFederatedLogout(request);
  }

  const token = cookies().get("tools_token")?.value?.trim();
  const tokenExpiresAt = token ? readJwtExpSec(token) : null;
  const lite = request.nextUrl.searchParams.get("lite") === "1";

  if (!token) {
    return NextResponse.json({
      hasCookie: false,
      active: false,
      introspect: null,
      tokenExpiresAt,
    });
  }

  // 心跳 / 路由切换：只读 JWT 过期，避免每次菜单点击都等 introspect（常 10s+）
  if (lite) {
    return NextResponse.json({
      hasCookie: true,
      active: !isToolsJwtExpired(token),
      introspect: null,
      tokenExpiresAt,
    });
  }

  if (!getMainSiteOrigin()) {
    return NextResponse.json({
      hasCookie: true,
      active: !isToolsJwtExpired(token),
      introspect: null,
      tokenExpiresAt,
    });
  }

  const session = await fetchEcomToolsSessionWithIntrospect(token);
  const out = NextResponse.json({
    hasCookie: session.hasCookie,
    active: session.active,
    introspect: session.introspect,
    introspectStatus: session.introspectStatus,
    tokenExpiresAt: session.tokenExpiresAt ?? tokenExpiresAt,
  });

  if (!session.active) {
    out.cookies.set("tools_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  return out;
}
