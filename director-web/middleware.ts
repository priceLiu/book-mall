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
    process.env.DIRECTOR_WEB_PUBLIC_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_DIRECTOR_WEB_ORIGIN?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/**
 * 注意：3D导演台是纯前端编辑器，且以 iframe 方式嵌入 canvas-web。
 * 因此此处 **不做** 强制 SSO 登录门禁（否则 iframe 内会被重定向到主站登录、被 X-Frame 拦截）。
 * 登录仅经 `/auth/sso/callback` 可选换票；此处仅在生产做规范域名跳转。
 */
export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const canonicalOrigin = getCanonicalOrigin();
  if (!canonicalOrigin) return NextResponse.next();

  let canonicalHost: string;
  try {
    canonicalHost = new URL(canonicalOrigin).host;
  } catch {
    return NextResponse.next();
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|woff2?|js|css|map|glb|gltf|fbx|obj)$).*)",
  ],
};
