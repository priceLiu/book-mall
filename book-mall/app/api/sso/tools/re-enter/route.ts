import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { issueToolsSsoRedirect } from "@/lib/issue-tools-sso-redirect";
import { parsePlatformSsoApp } from "@/lib/platform-app-sso";
import { getBookMallOrigin } from "@/lib/gateway/env";
import {
  buildBookMallLoginRedirectUrl,
  PRODUCTION_MAIN_SITE_ORIGIN,
  productionHttpsRedirectUrlFromHeaders,
} from "@/lib/production-origin";
import { sanitizeToolsRedirectPath } from "@/lib/sanitize-tools-redirect-path";

const RE_ENTER_PATH = "/api/sso/tools/re-enter";

export const dynamic = "force-dynamic";

/**
 * GET：会话失效后从子应用打开此链接；未登录则跳转登录（callbackUrl 带回本接口），
 * 已登录则直接签发 code 并 302 至子应用 `/auth/sso/callback`（或第三方 redirect_uri）。
 *
 * Query：
 * - `redirect` — 子应用内路径，默认 `/fitting-room`
 * - `app` — tool | canvas | story | prompt-optimizer（默认 tool）
 * - `client_id` + `redirect_uri` — Phase F 第三方注册客户端
 */
export async function GET(req: NextRequest) {
  const httpsTarget = productionHttpsRedirectUrlFromHeaders(
    req.headers,
    req.nextUrl.pathname,
    req.nextUrl.search,
  );
  if (httpsTarget) {
    return NextResponse.redirect(httpsTarget, 308);
  }

  const rp = req.nextUrl.searchParams.get("redirect") ?? undefined;
  const redirectPath = sanitizeToolsRedirectPath(rp);
  const app = parsePlatformSsoApp(req.nextUrl.searchParams.get("app"));
  const clientId = req.nextUrl.searchParams.get("client_id")?.trim() || undefined;
  const redirectUri = req.nextUrl.searchParams.get("redirect_uri")?.trim() || undefined;

  const session = await getServerSession(authOptions);

  /** 勿用 req.nextUrl.origin：CloudBase 容器内常为 http://0.0.0.0:3000。 */
  const bookOrigin = getBookMallOrigin() ?? PRODUCTION_MAIN_SITE_ORIGIN;
  const returnParams = new URLSearchParams({ redirect: redirectPath });
  if (app !== "tool") returnParams.set("app", app);
  if (clientId) returnParams.set("client_id", clientId);
  if (redirectUri) returnParams.set("redirect_uri", redirectUri);
  const loginUrl = buildBookMallLoginRedirectUrl(
    RE_ENTER_PATH,
    `?${returnParams}`,
  );

  if (!session?.user?.id) {
    return NextResponse.redirect(loginUrl);
  }

  const result = await issueToolsSsoRedirect({
    userId: session.user.id,
    redirectPath,
    app,
    clientId,
    redirectUri,
  });

  if (!result.ok) {
    const url = new URL("/account", bookOrigin);
    const code =
      result.code ??
      (result.status === 503
        ? "TOOLS_SSO_UNAVAILABLE"
        : result.status === 403
          ? "TOOLS_ACCESS_DENIED"
          : "TOOLS_SSO_UNKNOWN");
    url.searchParams.set("tools_sso_err", code);
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(result.redirectUrl);
}
