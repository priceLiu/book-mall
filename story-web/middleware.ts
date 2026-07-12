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
    process.env.STORY_PUBLIC_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_STORY_WEB_ORIGIN?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/**
 * story-web 首页/空间为公开落地页（Book 观众会话，非 tools_token），
 * 受保护路径（/projects、/project/*）由客户端 RequireAuth 负责静默 re-enter
 * 并在耗尽后跳本域 /login。因此这里不做 tools_token 硬闸，
 * 仅在生产做规范域名（canonical host）重定向，避免默认云托管域名暴露。
 */
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|woff2?|js|css|map)$).*)",
  ],
};
