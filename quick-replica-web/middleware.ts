import { NextResponse, type NextRequest } from "next/server";

function incomingHost(request: NextRequest): string {
  const xf = request.headers.get("x-forwarded-host");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("host") ?? "";
}

function isTencentCloudRunDefaultHost(host: string): boolean {
  return host.toLowerCase().endsWith(".sh.run.tcloudbase.com");
}

function getCanonicalOrigin(): string | null {
  const raw =
    process.env.QUICK_REPLICA_PUBLIC_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_QUICK_REPLICA_ORIGIN?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/auth/sso/callback")) return true;
  if (pathname.startsWith("/sso-error")) return true;
  if (pathname.startsWith("/_next/")) return true;
  // 门户独立入口：落地页与品牌登录/注册页无需 token（供 SEO 与直接注册登录）。
  if (pathname === "/") return true;
  if (pathname === "/login" || pathname === "/register") return true;
  if (pathname === "/favicon.ico" || pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;
  if (/\.[a-z0-9]+$/i.test(pathname)) return true;
  return false;
}

/** 未认证访问受保护路径 → 跳本域品牌登录页（不再弹主站）。 */
function buildLocalLoginUrl(request: NextRequest): URL {
  const url = new URL("/login", request.url);
  const redirect = request.nextUrl.pathname + request.nextUrl.search || "/";
  url.searchParams.set("redirect", redirect);
  return url;
}

export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    const canonicalOrigin = getCanonicalOrigin();
    if (canonicalOrigin) {
      let canonicalHost: string;
      try {
        canonicalHost = new URL(canonicalOrigin).host;
      } catch {
        canonicalHost = "";
      }
      const requestHost = incomingHost(request);
      if (
        requestHost &&
        requestHost !== canonicalHost &&
        isTencentCloudRunDefaultHost(requestHost) &&
        (request.method === "GET" || request.method === "HEAD") &&
        !request.nextUrl.pathname.startsWith("/api/")
      ) {
        const dest = new URL(
          request.nextUrl.pathname + request.nextUrl.search,
          canonicalOrigin,
        );
        return NextResponse.redirect(dest, 308);
      }
    }
  }

  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("tools_token")?.value?.trim();
  if (token) return NextResponse.next();

  return NextResponse.redirect(buildLocalLoginUrl(request));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|woff2?|js|css|map)$).*)",
  ],
};
