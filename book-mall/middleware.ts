import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";
import {
  allowCloudbaseDefaultOrigins,
  PRODUCTION_MAIN_SITE_ORIGIN,
} from "@/lib/production-origin";

function incomingHost(request: NextRequest): string {
  const xf = request.headers.get("x-forwarded-host");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("host") ?? "";
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

const withAuthMiddleware = withAuth(
  function middleware(req) {
    const path = req.nextUrl.pathname;
    if (
      (path === "/admin" || path.startsWith("/admin/")) &&
      req.nextauth.token?.role !== "ADMIN"
    ) {
      return NextResponse.redirect(new URL("/account", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        if (path === "/account") return !!token;
        if (path === "/admin" || path.startsWith("/admin/")) return !!token;
        return true;
      },
    },
  },
);

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  const early = canonicalBookHostRedirect(request);
  if (early) return early;

  const path = request.nextUrl.pathname;
  const needsAuth =
    path === "/account" || path === "/admin" || path.startsWith("/admin/");

  if (!needsAuth) {
    return NextResponse.next();
  }

  // withAuth 在中间件内会扩展 request；此处路径已限定为需鉴权路由。
  return withAuthMiddleware(
    request as Parameters<typeof withAuthMiddleware>[0],
    event,
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|woff2?)$).*)",
  ],
};
