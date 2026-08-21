import { NextResponse, type NextRequest } from "next/server";

import { appendSsoReenterSuppressCookie } from "@private/federated-portal-logout";
import { getMainSiteOrigin } from "@/lib/site-origin";
import { resolveToolsLogoutNextUrl } from "@/lib/tools-logout-next-url";

export const dynamic = "force-dynamic";

/** 清除 common-tools tools_token；联邦 logout 链上的 `next` 跳转。 */
export async function GET(request: NextRequest) {
  const main = getMainSiteOrigin();
  const fallback =
    main != null && main.length > 0
      ? new URL("/", main).toString()
      : new URL("/", request.url).toString();
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
