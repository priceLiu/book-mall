import { NextResponse, type NextRequest } from "next/server";
import { getToolsSitePublicOrigin } from "@/lib/site-origin";

/**
 * 生产环境下：若已配置公网工具站 Origin（TOOLS_PUBLIC_ORIGIN），但请求仍落在
 * 腾讯云云托管默认域名（*.sh.run.tcloudbase.com），则 308 到 canonical，避免
 * SSO 与 Cookie 落在默认域、与自定义域混用。
 *
 * 本地与其它 Host 不处理；仅针对已知的默认网关 Host 模式，降低误伤健康检查与其它代理。
 */
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

export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const canonicalOrigin = getToolsSitePublicOrigin();
  if (!canonicalOrigin) {
    return NextResponse.next();
  }

  let canonicalHost: string;
  try {
    canonicalHost = new URL(canonicalOrigin).host;
  } catch {
    return NextResponse.next();
  }

  const requestHost = incomingHost(request);
  if (!requestHost || requestHost === canonicalHost) {
    return NextResponse.next();
  }

  if (!isTencentCloudRunDefaultHost(requestHost)) {
    return NextResponse.next();
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }

  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/")) {
    return NextResponse.next();
  }

  const dest = new URL(path + request.nextUrl.search, canonicalOrigin);
  return NextResponse.redirect(dest, 308);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|woff2?)$).*)",
  ],
};
