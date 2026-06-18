import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest } from "@/lib/auth-from-request";
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

function attachSignOutCookies(res: NextResponse): NextResponse {
  appendClearSessionCookieHeaders(res.headers);
  res.headers.append(
    "Set-Cookie",
    buildSetSsoReenterSuppressCookieHeader(300),
  );
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/**
 * 生产 CloudBase：无 federated 链时用相对 Location（`/…`），避免容器内 origin 泄漏。
 * 有 federated 链时用短首跳 URL + `/api/auth/federated-logout` 分步，避免嵌套 next 触发网关 502。
 */
function buildRedirectResponse(
  callbackPath: string,
  location: string,
): NextResponse {
  if (location.startsWith("http://") || location.startsWith("https://")) {
    return attachSignOutCookies(NextResponse.redirect(location, 302));
  }
  return attachSignOutCookies(
    new NextResponse(null, {
      status: 302,
      headers: { Location: callbackPath },
    }),
  );
}

async function handle(request: NextRequest): Promise<NextResponse> {
  const callbackUrl = safeRedirectTarget(
    request.nextUrl.searchParams.get("callbackUrl"),
  );

  try {
    const auth = await getAuthFromRequest(request);
    if (auth?.sub) {
      try {
        await bumpSessionVersion(auth.sub);
      } catch {
        /* 非致命 */
      }
    }

    const finalUrl = resolveBookMallCallbackUrl(
      callbackUrl,
      request.nextUrl.origin,
    );
    const location = buildFederatedToolsLogoutStartUrl(finalUrl);
    return buildRedirectResponse(callbackUrl, location);
  } catch {
    return buildRedirectResponse(callbackUrl, callbackUrl);
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
