import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { issueToolsSsoRedirect } from "@/lib/issue-tools-sso-redirect";
import { sanitizeToolsRedirectPath } from "@/lib/sanitize-tools-redirect-path";

const RE_ENTER_PATH = "/api/sso/tools/re-enter";

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
    return NextResponse.redirect(new URL("/account", req.nextUrl.origin));
  }

  return NextResponse.redirect(result.redirectUrl);
}
