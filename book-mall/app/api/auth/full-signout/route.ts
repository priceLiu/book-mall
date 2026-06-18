import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest } from "@/lib/auth-from-request";
import { bumpSessionVersion } from "@/lib/auth-session-version";
import { appendClearSessionCookieHeaders } from "@/lib/auth/clear-session-cookie-headers";
import { buildFederatedLogoutRelativeEntry } from "@/lib/federated-tools-logout";
import { buildSetSsoReenterSuppressCookieHeader } from "@/lib/sso-reenter-suppress-cookie";

export const dynamic = "force-dynamic";

function safeRedirectTarget(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
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
