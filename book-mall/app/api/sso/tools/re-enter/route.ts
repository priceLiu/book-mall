import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { issueToolsSsoRedirect } from "@/lib/issue-tools-sso-redirect";
import { sanitizeToolsRedirectPath } from "@/lib/sanitize-tools-redirect-path";

const RE_ENTER_PATH = "/api/sso/tools/re-enter";

export const dynamic = "force-dynamic";

/**
 * GET：会话失效后从工具站打开此链接；未登录则跳转登录（callbackUrl 带回本接口），
 * 已登录则直接签发 code 并 302 至工具站 `/auth/sso/callback`。
 *
 * Query：`redirect` — 工具站内路径，默认 `/fitting-room`，须以 `/` 开头。
 */
export async function GET(req: NextRequest) {
  const rp = req.nextUrl.searchParams.get("redirect") ?? undefined;
  const redirectPath = sanitizeToolsRedirectPath(rp);

  const session = await getServerSession(authOptions);

  const loginUrl = new URL("/login", req.nextUrl.origin);
  const returnTo = `${RE_ENTER_PATH}?redirect=${encodeURIComponent(redirectPath)}`;
  loginUrl.searchParams.set("callbackUrl", returnTo);

  if (!session?.user?.id) {
    return NextResponse.redirect(loginUrl);
  }

  const result = await issueToolsSsoRedirect({
    userId: session.user.id,
    redirectPath,
  });

  if (!result.ok) {
    const url = new URL("/account", req.nextUrl.origin);
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
