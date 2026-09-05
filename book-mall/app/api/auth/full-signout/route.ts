import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest } from "@/lib/auth-from-request";
import { bumpSessionVersion } from "@/lib/auth-session-version";
import { appendClearSessionCookieHeaders } from "@/lib/auth/clear-session-cookie-headers";
import { buildFederatedLogoutRelativeEntry } from "@/lib/federated-tools-logout";
import { listPlatformWebOrigins } from "@/lib/platform-web-origins";
import { buildSetSsoReenterSuppressCookieHeader } from "@/lib/sso-reenter-suppress-cookie";

export const dynamic = "force-dynamic";

function resolveSignOutCallback(raw: string | null, requestOrigin: string): string {
  if (!raw?.trim()) return "/";
  const trimmed = raw.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const u = new URL(trimmed);
      const allowed = new Set(listPlatformWebOrigins(requestOrigin));
      if (allowed.has(u.origin.replace(/\/$/, ""))) {
        return u.toString();
      }
    } catch {
      return "/";
    }
    return "/";
  }
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/";
  return trimmed;
}

function signOutRedirectResponse(location: string): NextResponse {
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

async function handle(request: NextRequest): Promise<NextResponse> {
  const callbackUrl = resolveSignOutCallback(
    request.nextUrl.searchParams.get("callbackUrl"),
    request.nextUrl.origin,
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
  } catch {
    /* 非致命 */
  }

  const federatedEntry = buildFederatedLogoutRelativeEntry(callbackUrl);
  const location = federatedEntry ?? callbackUrl;
  return signOutRedirectResponse(location);
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
