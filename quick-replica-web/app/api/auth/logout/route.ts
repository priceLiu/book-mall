import { NextResponse, type NextRequest } from "next/server";
import { getAppPublicOrigin, getMainSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

/**
 * 门户登出：清除本域 tools_token，并跳转 Book 联邦登出以结束共享会话。
 */
export async function GET(request: NextRequest) {
  const base = getAppPublicOrigin() ?? request.nextUrl.origin;
  const bookOrigin = getMainSiteOrigin();

  const homeUrl = new URL("/", base);
  const target = bookOrigin
    ? new URL(
        `/api/auth/full-signout?callbackUrl=${encodeURIComponent(homeUrl.toString())}`,
        bookOrigin,
      )
    : homeUrl;

  const res = NextResponse.redirect(target);
  res.cookies.set("tools_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
