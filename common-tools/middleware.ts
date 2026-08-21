import { NextResponse, type NextRequest } from "next/server";
import { fireTrafficHitFromRequest } from "@/lib/platform-traffic";

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
    process.env.COMMON_TOOLS_PUBLIC_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_COMMON_TOOLS_ORIGIN?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  fireTrafficHitFromRequest("common-tools", request);

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
