import { NextRequest, NextResponse } from "next/server";
import { appendClearSessionCookieHeaders } from "@/lib/auth/clear-session-cookie-headers";

export const dynamic = "force-dynamic";

function safeRedirectTarget(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

async function handle(request: NextRequest): Promise<NextResponse> {
  /**
   * 用相对路径作 Location，让浏览器按当前请求的 origin 解析。
   * CloudBase Run 容器里 `request.nextUrl.origin` 会是内部 0.0.0.0:3000，
   * 用绝对 URL 重定向会跳到无法访问的地址。
   */
  const callbackUrl = safeRedirectTarget(
    request.nextUrl.searchParams.get("callbackUrl"),
  );
  const res = new NextResponse(null, {
    status: 302,
    headers: {
      Location: callbackUrl,
      "Cache-Control": "no-store",
    },
  });

  appendClearSessionCookieHeaders(res.headers);

  return res;
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
