import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { bumpSessionVersion } from "@/lib/auth-session-version";
import { appendClearSessionCookieHeaders } from "@/lib/auth/clear-session-cookie-headers";

export const dynamic = "force-dynamic";

/**
 * 自定义全量登出：清理 NextAuth 所有可能的 Cookie 变体（host-only + 共享域 + localhost 开发域）。
 *
 * 背景：升级到 `NEXTAUTH_COOKIE_DOMAIN=.ai-code8.com` 后，浏览器里仍残留升级前
 * 签发的 host-only `__Secure-next-auth.session-token` / `__Host-next-auth.csrf-token`。
 * NextAuth 自带的 signOut 只按当前配置清新版 Cookie，旧 Cookie 不会被清，导致
 * 「正常模式点了退出还是登录态、无痕模式正常」的现象。
 *
 * 实现要点：浏览器把 (name, domain, path) 视作不同 Cookie——
 * 同名但 domain 不同的 host-only / 共享域 Cookie 必须用 **多条同名 Set-Cookie**
 * 分别清。`NextResponse.cookies.set` 内部按 name 去重，会把 host-only 的 Set-Cookie
 * 覆盖成共享域版，所以这里改为手动 `headers.append('Set-Cookie', ...)`。
 */

function safeRedirectTarget(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

async function handle(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    try {
      await bumpSessionVersion(session.user.id);
    } catch {
      /* 非致命：仍继续清 Cookie */
    }
  }

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
