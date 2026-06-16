import { NextResponse, type NextRequest } from "next/server";
import { resolveToolsLogoutNextUrl, appendSsoReenterSuppressCookie } from "@/lib/tools-logout-next-url";
import { getMainSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

/** 清除电商工具箱的 tools_token，并继续 federated logout 链或回主站。 */
export async function GET(request: NextRequest) {
  const main = getMainSiteOrigin();
  const fallback =
    main != null && main.length > 0 ? new URL("/", main).toString() : new URL("/", request.url).toString();
  const targetUrl = resolveToolsLogoutNextUrl(
    request.nextUrl.searchParams.get("next"),
    fallback,
    request.nextUrl.origin,
  );

  const res = NextResponse.redirect(targetUrl);
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set("tools_token", "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  appendSsoReenterSuppressCookie(res);
  return res;
}
