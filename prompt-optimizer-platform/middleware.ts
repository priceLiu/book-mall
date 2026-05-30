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
    process.env.PROMPT_OPTIMIZER_PUBLIC_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_PROMPT_OPTIMIZER_ORIGIN?.trim();
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
  if (pathname === "/favicon.ico" || pathname === "/robots.txt") return true;
  if (/\.[a-z0-9]+$/i.test(pathname)) return true;
  return false;
}

function buildReEnterUrl(request: NextRequest): string | null {
  const main =
    process.env.MAIN_SITE_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_BOOK_MALL_URL?.trim();
  if (!main) return null;
  const base = main.replace(/\/$/, "");
  const redirect =
    request.nextUrl.pathname + request.nextUrl.search || "/";
  const q = new URLSearchParams({
    app: "prompt-optimizer",
    redirect,
  });
  return `${base}/api/sso/tools/re-enter?${q}`;
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

  const reEnter = buildReEnterUrl(request);
  if (reEnter) {
    return NextResponse.redirect(reEnter);
  }

  return NextResponse.redirect(
    new URL("/sso-error?reason=missing_main_origin", request.url),
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|woff2?|js|css|map)$).*)",
  ],
};
