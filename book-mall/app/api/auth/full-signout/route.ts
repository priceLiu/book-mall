import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { bumpSessionVersion } from "@/lib/auth-session-version";
import { appendClearSessionCookieHeaders } from "@/lib/auth/clear-session-cookie-headers";
import {
  buildFederatedToolsLogoutStartUrl,
  resolveBookMallCallbackUrl,
} from "@/lib/federated-tools-logout";
import { buildSetSsoReenterSuppressCookieHeader } from "@/lib/sso-reenter-suppress-cookie";

export const dynamic = "force-dynamic";

function safeRedirectTarget(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

async function handle(request: NextRequest): Promise<NextResponse> {
  const callbackUrl = safeRedirectTarget(
    request.nextUrl.searchParams.get("callbackUrl"),
  );

  /**
   * 关键：book-mall 用无状态 JWT 会话，退出仅清除「当前浏览器」Cookie。
   * 其它浏览器 / 无痕窗口持有的 JWT 在过期前仍有效，必须自增 sessionVersion，
   * 让所有已签发会话在下次校验（SINGLE_SESSION_ENFORCE，≤60s）时失效。
   */
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      await bumpSessionVersion(session.user.id);
    }
  } catch {
    /* 非致命：仍清 Cookie 并继续退出 */
  }

  const finalUrl = resolveBookMallCallbackUrl(
    callbackUrl,
    request.nextUrl.origin,
  );
  const location = buildFederatedToolsLogoutStartUrl(finalUrl);

  const res = new NextResponse(null, {
    status: 302,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
    },
  });

  appendClearSessionCookieHeaders(res.headers);
  res.headers.append(
    "Set-Cookie",
    buildSetSsoReenterSuppressCookieHeader(300),
  );

  return res;
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
