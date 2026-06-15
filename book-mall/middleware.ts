import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  allowCloudbaseDefaultOrigins,
  buildBookMallLoginRedirectUrl,
  incomingRequestProto,
  isProductionAiCode8Host,
  PRODUCTION_MAIN_SITE_ORIGIN,
  shouldEnforceProductionHttps,
} from "@/lib/production-origin";

function incomingHost(request: NextRequest): string {
  const xf = request.headers.get("x-forwarded-host");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("host") ?? "";
}

function withProductionSecurityHeaders(
  response: NextResponse,
  request: NextRequest,
): NextResponse {
  if (process.env.NODE_ENV !== "production") return response;
  const host = incomingHost(request);
  if (!isProductionAiCode8Host(host)) return response;

  response.headers.set("Content-Security-Policy", "upgrade-insecure-requests");
  const proto = incomingRequestProto(
    request.headers.get("x-forwarded-proto"),
    request.nextUrl.protocol,
    request.headers.get("forwarded"),
  );
  if (proto === "https") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains",
    );
  }
  return response;
}

/** 用户仍打开 book-mall-*.sh.run 时引导到正式域（含首页、登出回调路径）。 */
function canonicalBookHostRedirect(request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== "production") return null;
  if (allowCloudbaseDefaultOrigins()) return null;

  const requestHost = incomingHost(request).toLowerCase();
  if (!requestHost.endsWith(".sh.run.tcloudbase.com")) return null;

  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/")) return null;

  const dest = new URL(
    request.nextUrl.pathname + request.nextUrl.search,
    PRODUCTION_MAIN_SITE_ORIGIN,
  );
  return NextResponse.redirect(dest, 308);
}

/** 公网 HTTP 访问时 Secure Cookie 无法落盘，须先跳转到 HTTPS。 */
function enforceProductionHttpsRedirect(request: NextRequest): NextResponse | null {
  const host = incomingHost(request);
  const proto = incomingRequestProto(
    request.headers.get("x-forwarded-proto"),
    request.nextUrl.protocol,
    request.headers.get("forwarded"),
  );
  if (!shouldEnforceProductionHttps(host, proto)) return null;

  const dest = new URL(
    request.nextUrl.pathname + request.nextUrl.search,
    `https://${host.toLowerCase()}`,
  );
  const status =
    request.method === "GET" || request.method === "HEAD" ? 308 : 307;
  return NextResponse.redirect(dest, status);
}

export default async function middleware(request: NextRequest) {
  const httpsRedirect = enforceProductionHttpsRedirect(request);
  if (httpsRedirect) {
    return withProductionSecurityHeaders(httpsRedirect, request);
  }

  const early = canonicalBookHostRedirect(request);
  if (early) return withProductionSecurityHeaders(early, request);

  const path = request.nextUrl.pathname;
  if (path.startsWith("/invite/")) {
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.headers.set("Pragma", "no-cache");
    return withProductionSecurityHeaders(res, request);
  }

  const needsAuth =
    path === "/account" ||
    path.startsWith("/account/") ||
    path === "/admin" ||
    path.startsWith("/admin/");

  if (needsAuth) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token?.sub) {
      const loginUrl = buildBookMallLoginRedirectUrl(
        path,
        request.nextUrl.search,
      );
      return withProductionSecurityHeaders(
        NextResponse.redirect(loginUrl, 307),
        request,
      );
    }

    if (
      (path === "/admin" || path.startsWith("/admin/")) &&
      token.role !== "ADMIN"
    ) {
      return withProductionSecurityHeaders(
        NextResponse.redirect(new URL("/account", PRODUCTION_MAIN_SITE_ORIGIN)),
        request,
      );
    }
  }

  return withProductionSecurityHeaders(NextResponse.next(), request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|woff2?)$).*)",
  ],
};
