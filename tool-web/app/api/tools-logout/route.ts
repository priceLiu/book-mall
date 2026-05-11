import { NextResponse, type NextRequest } from "next/server";
import { getMainSiteOrigin } from "@/lib/site-origin";

/** 清除工具站会话 Cookie，并跳转主站首页（后续可做独立工具站首页 landing）。 */
export async function GET(request: NextRequest) {
  const main = getMainSiteOrigin();
  const targetUrl =
    main != null && main.length > 0 ? new URL("/", main) : new URL("/", request.url);

  const res = NextResponse.redirect(targetUrl);
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set("tools_token", "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
