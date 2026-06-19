import { NextResponse, type NextRequest } from "next/server";

import { getMainSiteOrigin } from "@/lib/site-origin";
import {
  appendSsoReenterSuppressCookie,
  resolveToolsLogoutNextUrl,
} from "@/lib/tools-logout-next-url";

export function isToolsFederatedLogoutRequest(
  request: NextRequest,
): boolean {
  return request.nextUrl.searchParams.get("federated_logout") === "1";
}

/** federated logout 链：清 tools_token 并 302 到 book 下一步。 */
export function respondToolsFederatedLogout(
  request: NextRequest,
): NextResponse {
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

  const res = NextResponse.redirect(targetUrl, 302);
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
